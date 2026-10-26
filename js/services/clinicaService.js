import { crud, http } from "../core/http.js";
import { toClinica } from "../mappers/index.js";

const clinicas = crud("/clinicas");
const clinicaEspecialidades = crud("/clinica-especialidade");

export const clinicaService = {
  async listar({ apenasAtivas = true } = {}) {
    const lista = (await clinicas.listar()).map(toClinica);
    return apenasAtivas ? lista.filter((c) => c.ativo) : lista;
  },

  async buscar(id) {
    return toClinica(await clinicas.buscar(id));
  },

  // GET /clinicas é só do administrador. Para os demais perfis, as clínicas vêm embutidas nos vínculos
  // (clínica-especialidade e profissional-clínica). Clínica sem nenhum vínculo não aparece por este caminho.
  async listarPelosVinculos({ apenasAtivas = true } = {}) {
    const [porEspecialidade, porProfissional] = await Promise.all([clinicaEspecialidades.listar(), http("/profissional-clinica")]);
    const porId = new Map();
    for (const x of [...porEspecialidade, ...porProfissional]) {
      if (x.clinica && !porId.has(String(x.clinica.id_clinica))) porId.set(String(x.clinica.id_clinica), toClinica(x.clinica));
    }
    const lista = [...porId.values()].sort((a, b) => a.id - b.id);
    return apenasAtivas ? lista.filter((c) => c.ativo) : lista;
  },

  // [{ idClinica, idEspecialidade }]
  async listarEspecialidades() {
    const lista = await clinicaEspecialidades.listar();
    return lista.map((x) => ({
      idClinica: Number(x.id_clinica),
      idEspecialidade: Number(x.id_especialidade),
    }));
  },

  // Ativar/desativar (a clínica some das telas do paciente, mas o histórico fica).
  async alterarAtivo(id, ativo) {
    await clinicas.atualizar(id, { ativo });
  },

  // O formulário tem um único campo "Endereço completo"; ele é gravado em `logradouro`.
  // Ao trocar o endereço, número/bairro/cidade/UF antigos são limpos para não ficarem divergentes.
  _corpo({ nome, cnpj, endereco, telefone, email, ativo }, { limparEndereco = false } = {}) {
    const corpo = {
      nome,
      cnpj,
      telefone: telefone || null,
      email: email || null,
      ativo,
    };
    if (endereco !== undefined) {
      corpo.logradouro = endereco || null;
      if (limparEndereco) Object.assign(corpo, { numero: null, bairro: null, cidade: null, uf: null });
    }
    return corpo;
  },

  // Cria a clínica e depois vincula as especialidades (o back-end não tem transação:
  // se algum vínculo falhar, a clínica recém-criada é removida).
  async criar(dados, idsEspecialidades = []) {
    const nova = await clinicas.criar(this._corpo(dados));
    const id = Number(nova.id_clinica);
    try {
      for (const idEsp of idsEspecialidades) {
        await clinicaEspecialidades.criar({ id_clinica: id, id_especialidade: Number(idEsp) });
      }
    } catch (erro) {
      for (const idEsp of idsEspecialidades) {
        await clinicaEspecialidades.remover(`${id}/${idEsp}`).catch(() => {});
      }
      await clinicas.remover(id).catch(() => {});
      throw erro;
    }
    return id;
  },

  // `antes` = especialidades que a clínica já tinha; `depois` = as escolhidas agora.
  async atualizar(id, dados, { antes = [], depois = [], enderecoMudou = false } = {}) {
    await clinicas.atualizar(id, this._corpo(dados, { limparEndereco: enderecoMudou }));
    const aAdicionar = depois.filter((x) => !antes.includes(x));
    const aRemover = antes.filter((x) => !depois.includes(x));
    for (const idEsp of aAdicionar) {
      await clinicaEspecialidades.criar({ id_clinica: Number(id), id_especialidade: Number(idEsp) });
    }
    for (const idEsp of aRemover) {
      await clinicaEspecialidades.remover(`${id}/${idEsp}`);
    }
  },
};
