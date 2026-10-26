// Início do paciente: saudação, atalhos e barra de navegação inferior.
import { exigirLogin, PERFIS } from "../core/guard.js";
import { $ } from "../core/dom.js";
import { montarNavPaciente, definirSelo } from "../ui/navPaciente.js";
import { agendamentoService, contarConsultasEmAberto } from "../services/agendamentoService.js";
import { hojeISO, agoraHHMM } from "../core/datetime.js";
import { registrarPwa } from "../pwa.js";

async function iniciar(s) {
  registrarPwa();
  const primeiroNome = String(s.nome ?? "").trim().split(/\s+/)[0];
  $("#saudacao").textContent = primeiroNome ? `Olá, ${primeiroNome}!` : "Olá!";
  document.title = "Início | TriaOrto+";

  montarNavPaciente("inicio");

  // O selo é um complemento: se a API estiver fora, a tela continua funcionando sem ele.
  try {
    if (s.idPaciente) {
      const todos = await agendamentoService.listar();
      definirSelo("consultas", contarConsultasEmAberto(todos, Number(s.idPaciente), hojeISO(), agoraHHMM()));
    }
  } catch {
    /* sem selo */
  }
}

const sessao = exigirLogin([PERFIS.PACIENTE]);
if (sessao) iniciar(sessao);
