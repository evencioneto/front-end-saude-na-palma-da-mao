import { http, ApiError } from "../core/http.js";
import { sessao } from "../core/session.js";
import { pacienteApi } from "./usuarioService.js";

const normalizar = (s) => String(s ?? "").trim().toLowerCase();
const apenasDigitos = (s) => String(s ?? "").replace(/\D/g, "");

export const authService = {
  // "identificador" pode ser e-mail ou CPF.
  async login(identificador, senha, { lembrar = true } = {}) {
    const entrada = String(identificador ?? "").trim();
    if (!entrada || !senha) throw new ApiError("Informe o e-mail ou CPF e a senha.", 400);

    let email = entrada;

    // Se o usuário digitou um CPF em vez de e-mail, localiza o e-mail correspondente:
    if (!entrada.includes("@")) {
      const cpf = apenasDigitos(entrada);
      const pacientes = await pacienteApi.listar();
      const p = pacientes.find((x) => apenasDigitos(x.cpf) === cpf);
      if (!p || !p.usuario?.email) {
        throw new ApiError("Nenhum cadastro encontrado para este CPF.", 401);
      }
      email = p.usuario.email;
    }

    // 1. Autenticação oficial no backend (gera o JWT)
    const resposta = await http("/auth/login", {
      method: "POST",
      body: { email: normalizar(email), senha },
    });

    const { token, usuario } = resposta;
    if (!token || !usuario) throw new ApiError("Falha ao obter dados de autenticação.", 500);

    const dados = {
      idUsuario: Number(usuario.id_usuario),
      nome: usuario.nome,
      email: usuario.email,
      tipo: usuario.tipo_usuario,
      token,
    };

    // 2. Se for PACIENTE ou ADMINISTRADOR, busca e vincula o id_paciente à sessão
    if (dados.tipo === "PACIENTE" || dados.tipo === "ADMINISTRADOR") {
      try {
        const pacientes = await pacienteApi.listar();
        let p = pacientes.find((x) => Number(x.id_usuario) === dados.idUsuario);
        if (!p) {
          p = await pacienteApi.criar({
            id_usuario: dados.idUsuario,
            cpf: "000.000.000-00",
            data_nascimento: "2000-01-01",
            sexo: null,
          });
        }
        if (p) dados.idPaciente = Number(p.id_paciente);
      } catch {
        /* se a listagem falhar, segue com os dados básicos */
      }
    }

    // 3. Se for PROFISSIONAL, busca e vincula o id_profissional
    if (dados.tipo === "PROFISSIONAL") {
      try {
        const profissionais = await http("/profissionais");
        const prof = profissionais.find((x) => Number(x.id_usuario) === dados.idUsuario);
        if (prof) dados.idProfissional = Number(prof.id_profissional);
      } catch {
        /* ignora */
      }
    }

    sessao.set(dados, { lembrar });
    return dados;
  },

  async registrarPaciente({ nome, email, senha, telefone, cpf, nascimento, sexo }) {
    // 1. Cria o usuário com senha criptografada pelo backend
    const usuario = await http("/auth/cadastro", {
      method: "POST",
      body: {
        nome,
        email,
        senha,
        telefone,
      },
    });

    // 2. Vincula os dados de paciente (CPF, nascimento, sexo)
    try {
      await pacienteApi.criar({
        id_usuario: Number(usuario.id_usuario),
        cpf,
        data_nascimento: nascimento,
        sexo: sexo || null,
      });
    } catch (erro) {
      throw erro;
    }
  },

  logout() {
    sessao.limpar();
    location.href = "index.html";
  },

  atual: () => sessao.get(),
};
