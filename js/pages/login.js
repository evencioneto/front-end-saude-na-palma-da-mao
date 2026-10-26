import { authService } from "../services/authService.js";
import { sessao } from "../core/session.js";
import { paginaInicial, PERFIS } from "../core/guard.js";
import { $, comBotaoOcupado, toast } from "../core/dom.js";
import { registrarPwa } from "../pwa.js";

registrarPwa();

// Perfil escolhido na tela anterior (entrar.html). Sem ele, qualquer conta pode entrar.
const PERFIL_ESCOLHIDO = {
  paciente: { tipo: PERFIS.PACIENTE, nome: "paciente" },
  profissional: { tipo: PERFIS.PROFISSIONAL, nome: "profissional de saúde" },
  administrador: { tipo: PERFIS.ADMIN, nome: "administrador" },
}[new URLSearchParams(location.search).get("perfil")];

function iniciar() {
  const form = $("#form-login");
  // Só paciente se cadastra sozinho; profissional e administrador são criados pelo administrador.
  if (PERFIL_ESCOLHIDO && PERFIL_ESCOLHIDO.tipo !== PERFIS.PACIENTE) $("#cadastro").hidden = true;
  const erro = $("#erro");
  const aviso = $("#aviso-lento");
  if (new URLSearchParams(location.search).has("expirou")) erro.textContent = "Sua sessão expirou. Entre novamente.";

  window.addEventListener("api:lenta", () => (aviso.hidden = false));
  window.addEventListener("api:ociosa", () => (aviso.hidden = true));

  // Ainda não existem no back-end: avisamos em vez de fingir que funcionam.
  $("#esqueci").addEventListener("click", (e) => {
    e.preventDefault();
    toast("Recuperação de senha ainda não está disponível. Procure o atendimento.");
  });
  $("#btn-google").addEventListener("click", () => toast("Entrar com o Google ainda não está disponível."));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    erro.textContent = "";
    if (!form.checkValidity()) {
      erro.textContent = "Informe seu e-mail ou CPF e a senha.";
      return;
    }
    const { identificador, senha } = Object.fromEntries(new FormData(form));
    try {
      const dados = await comBotaoOcupado($("button[type=submit]", form), "Entrando...", () =>
        authService.login(identificador, senha, { lembrar: $("#lembrar").checked }),
      );
      if (PERFIL_ESCOLHIDO && dados.tipo !== PERFIL_ESCOLHIDO.tipo) {
        sessao.limpar();
        erro.textContent = `Esta conta não é de ${PERFIL_ESCOLHIDO.nome}. Volte e escolha o perfil correto.`;
        return;
      }
      location.href = paginaInicial(dados.tipo);
    } catch (err) {
      erro.textContent = err.message;
    }
  });
}

// Fica no fim do arquivo: precisa que as constantes acima já existam.
const jaLogado = sessao.get();
if (jaLogado) {
  location.replace(paginaInicial(jaLogado.tipo));
} else {
  iniciar();
}
