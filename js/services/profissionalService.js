import { crud, http } from "../core/http.js";
import { toProfissional, toVinculo } from "../mappers/index.js";
import { usuarioApi } from "./usuarioService.js";

const soDigitos = (v) => String(v ?? "").replace(/\D/g, "");

const profissionais = crud("/profissionais");
const vinculos = crud("/profissional-clinica");
const profEspecialidades = crud("/profissional-especialidade");

export const profissionalService = {
  async listar() {
    return (await profissionais.listar()).map(toProfissional);
  },

  // GET /profissionais é só do administrador. Para os demais perfis, o profissional vem embutido nos vínculos,
  // mas sem o usuário: o nome aparece como "Profissional N" até o servidor liberar a leitura.
  async listarPelosVinculos() {
    const [porClinica, porEspecialidade] = await Promise.all([vinculos.listar(), profEspecialidades.listar()]);
    const porId = new Map();
    for (const x of [...porClinica, ...porEspecialidade]) {
      if (x.profissional && !porId.has(String(x.profissional.id_profissional))) porId.set(String(x.profissional.id_profissional), toProfissional(x.profissional));
    }
    return [...porId.values()].sort((a, b) => a.id - b.id);
  },

  async buscar(id) {
    // A listagem traz o usuário embutido (nome, e-mail, telefone); o GET por id não é usado de propósito.
    return (await this.listar()).find((p) => p.id === Number(id)) ?? null;
  },

  async alterarAtivo(id, ativo) {
    await profissionais.atualizar(id, { ativo });
  },

  async listarVinculos({ apenasAtivos = true } = {}) {
    const lista = (await vinculos.listar()).map(toVinculo);
    return apenasAtivos ? lista.filter((v) => v.ativo) : lista;
  },

  // [{ idProfissional, idEspecialidade }]
  async listarEspecialidades() {
    const lista = await profEspecialidades.listar();
    return lista.map((x) => ({
      idProfissional: Number(x.id_profissional),
      idEspecialidade: Number(x.id_especialidade),
    }));
  },

  // Cadastro em 4 etapas (o back-end não tem transação):
  // usuário -> profissional -> vínculo com a clínica -> especialidades.
  // Se alguma etapa falhar, desfaz o que já foi criado.
  async cadastrarCompleto({ usuario, profissional, idClinica, idsEspecialidades }) {
    const u = await usuarioApi.criar({
      nome: usuario.nome,
      email: usuario.email,
      senha_hash: usuario.senha, // PROVISÓRIO (ver authService)
      telefone: usuario.telefone,
      tipo_usuario: "PROFISSIONAL",
    });

    let p = null;
    try {
      p = await profissionais.criar({
        id_usuario: Number(u.id_usuario),
        cpf: profissional.cpf,
        conselho: profissional.conselho,
        registro_profissional: profissional.registro,
        uf_registro: profissional.uf,
        ativo: true,
      });

      await vinculos.criar({
        id_profissional: Number(p.id_profissional),
        id_clinica: Number(idClinica),
        ativo: true,
      });

      for (const idEsp of idsEspecialidades) {
        await profEspecialidades.criar({
          id_profissional: Number(p.id_profissional),
          id_especialidade: Number(idEsp),
        });
      }
    } catch (erro) {
      // Apaga de trás para frente. Falhas aqui são ignoradas para preservar o erro original.
      if (p) {
        await profissionais.remover(p.id_profissional).catch(() => {});
      }
      await usuarioApi.remover(u.id_usuario).catch(() => {});
      throw erro;
    }
  },

  // Cadastro feito pelo administrador (formulário "Novo profissional").
  // O formulário não tem senha: a senha inicial PROVISÓRIA é o CPF (só dígitos), até existir o fluxo real de login.
  async criarPeloAdmin({ nome, email, telefone, cpf, conselho, registro, uf, ativo, idsClinicas, idsEspecialidades }) {
    const u = await usuarioApi.criar({
      nome,
      email,
      senha_hash: soDigitos(cpf), // PROVISÓRIO (ver authService)
      telefone: telefone || null,
      tipo_usuario: "PROFISSIONAL",
    });
    let p = null;
    const vinculosCriados = [];
    const especialidadesCriadas = [];
    try {
      p = await profissionais.criar({
        id_usuario: Number(u.id_usuario),
        cpf,
        conselho,
        registro_profissional: registro,
        uf_registro: uf,
        ativo,
      });
      const idProf = Number(p.id_profissional);
      for (const idClinica of idsClinicas) {
        const v = await vinculos.criar({ id_profissional: idProf, id_clinica: Number(idClinica), ativo: true });
        vinculosCriados.push(v.id_profissional_clinica);
      }
      for (const idEsp of idsEspecialidades) {
        await profEspecialidades.criar({ id_profissional: idProf, id_especialidade: Number(idEsp) });
        especialidadesCriadas.push(idEsp);
      }
    } catch (erro) {
      // Desfaz de trás para frente; falhas aqui são ignoradas para preservar o erro original.
      if (p) {
        for (const idEsp of especialidadesCriadas) await profEspecialidades.remover(`${p.id_profissional}/${idEsp}`).catch(() => {});
        for (const idV of vinculosCriados) await vinculos.remover(idV).catch(() => {});
        await profissionais.remover(p.id_profissional).catch(() => {});
      }
      await usuarioApi.remover(u.id_usuario).catch(() => {});
      throw erro;
    }
    return Number(p.id_profissional);
  },

  // Edição: dados do usuário e do profissional + diferenças de clínicas e especialidades.
  // Vínculo com clínica nunca é apagado (pode ter agenda e consultas): é só desativado/reativado.
  async atualizarPeloAdmin(id, { idUsuario, nome, email, telefone, cpf, conselho, registro, uf, ativo, idsClinicas, idsEspecialidades }) {
    await usuarioApi.atualizar(idUsuario, { nome, email, telefone: telefone || null });
    await profissionais.atualizar(id, {
      cpf,
      conselho,
      registro_profissional: registro,
      uf_registro: uf,
      ativo,
    });

    const todosVinculos = (await vinculos.listar()).map(toVinculo).filter((v) => v.idProfissional === Number(id));
    for (const idClinica of idsClinicas) {
      const existente = todosVinculos.find((v) => v.idClinica === Number(idClinica));
      if (!existente) await vinculos.criar({ id_profissional: Number(id), id_clinica: Number(idClinica), ativo: true });
      else if (!existente.ativo) await vinculos.atualizar(existente.id, { ativo: true });
    }
    for (const v of todosVinculos) {
      if (v.ativo && !idsClinicas.map(Number).includes(v.idClinica)) await vinculos.atualizar(v.id, { ativo: false });
    }

    const atuais = (await this.listarEspecialidades()).filter((x) => x.idProfissional === Number(id)).map((x) => x.idEspecialidade);
    for (const idEsp of idsEspecialidades.map(Number)) {
      if (!atuais.includes(idEsp)) await profEspecialidades.criar({ id_profissional: Number(id), id_especialidade: idEsp });
    }
    for (const idEsp of atuais) {
      if (!idsEspecialidades.map(Number).includes(idEsp)) await profEspecialidades.remover(`${id}/${idEsp}`);
    }
  },
};
