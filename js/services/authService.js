// Autenticação com JWT (back-end: POST /auth/login e POST /auth/cadastro).
//
//  - login: troca e-mail + senha por { token, usuario }. O token vai na sessão e é enviado em toda chamada (core/http.js).
//  - cadastro: cria o usuário como PACIENTE e, em seguida, o registro de paciente (CPF, nascimento, sexo).
//  - "Entrar com CPF" continua funcionando: o CPF é trocado pelo e-mail do paciente antes de chamar o login.
//
// A senha é conferida e guardada (com hash) só pelo servidor; o app nunca a guarda.
import { http, ApiError } from "../core/http.js";
import { sessao } from "../core/session.js";
import { pacienteApi } from "./usuarioService.js";

const apenasDigitos = (s) => String(s ?? "").replace(/\D/g, "");
const FALHA_LOGIN = "E-mail, CPF ou senha incorretos.";

// Descobre o id de paciente/profissional do usuário que acabou de entrar. Usa só rotas liberadas para qualquer usuário logado.
async function completarDados(dados, token) {
  if (dados.tipo === "PACIENTE") {
    const pacientes = await http("/pacientes", { token });
    const p = pacientes.find((x) => Number(x.id_usuario) === dados.idUsuario);
    if (!p) throw new ApiError("Cadastro de paciente incompleto. Procure o atendimento.", 403);
    dados.idPaciente = Number(p.id_paciente);
  }

  if (dados.tipo === "PROFISSIONAL") {
    // /profissionais é só do administrador; os vínculos trazem o profissional embutido.
    for (const rota of ["/profissional-clinica", "/profissional-especialidade"]) {
      const lista = await http(rota, { token });
      const p = lista.map((x) => x.profissional).find((x) => x && Number(x.id_usuario) === dados.idUsuario);
      if (p) {
        dados.idProfissional = Number(p.id_profissional);
        break;
      }
    }
  }
}

export const authService = {
  // "identificador" pode ser e-mail ou CPF.
  async login(identificador, senha, { lembrar = true } = {}) {
    const entrada = String(identificador ?? "").trim();
    let email = entrada;

    if (!entrada.includes("@")) {
      const cpf = apenasDigitos(entrada);
      const pacientes = cpf.length === 11 ? await pacienteApi.listar() : [];
      email = pacientes.find((x) => apenasDigitos(x.cpf) === cpf)?.usuario?.email;
      if (!email) throw new ApiError(FALHA_LOGIN, 401);
    }

    let resposta;
    try {
      resposta = await http("/auth/login", { method: "POST", body: { email: email.toLowerCase(), senha }, autenticar: false });
    } catch (erro) {
      if (erro.status === 400 || erro.status === 401) throw new ApiError(FALHA_LOGIN, 401);
      throw erro;
    }

    const { token, usuario: u } = resposta;
    const dados = { idUsuario: Number(u.id_usuario), nome: u.nome, email: u.email, tipo: u.tipo_usuario, token };
    await completarDados(dados, token);

    sessao.set(dados, { lembrar });
    return dados;
  },

  async registrarPaciente({ nome, email, senha, telefone, cpf, nascimento, sexo }) {
    let idUsuario, token;
    try {
      const u = await http("/auth/cadastro", { method: "POST", body: { nome, email: email.toLowerCase(), senha, telefone }, autenticar: false });
      idUsuario = Number(u.id_usuario);
      // O cadastro não devolve token; entra em seguida para poder criar o paciente (o servidor pode exigir login).
      const r = await http("/auth/login", { method: "POST", body: { email: email.toLowerCase(), senha }, autenticar: false });
      token = r.token;
    } catch (erro) {
      // E-mail já cadastrado pode ser um cadastro que ficou pela metade (usuário criado, paciente não):
      // se a senha confere e ainda não há paciente, o cadastro continua dele.
      if (erro.status !== 409 || idUsuario) throw erro;
      const r = await http("/auth/login", { method: "POST", body: { email: email.toLowerCase(), senha }, autenticar: false }).catch(() => null);
      if (!r) throw erro;
      const pacientes = await http("/pacientes", { token: r.token });
      if (pacientes.some((p) => Number(p.id_usuario) === Number(r.usuario.id_usuario))) throw erro;
      idUsuario = Number(r.usuario.id_usuario);
      token = r.token;
    }

    await http("/pacientes", { method: "POST", token, body: { id_usuario: idUsuario, cpf, data_nascimento: nascimento, sexo: sexo || null } });
  },

  logout() {
    sessao.limpar();
    location.href = "index.html";
  },

  atual: () => sessao.get(),
};
