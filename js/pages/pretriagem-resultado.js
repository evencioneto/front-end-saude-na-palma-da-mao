// Resultado da pré-triagem: orientação inicial (sem diagnóstico) e caminho para clínicas ou agendamento.
// Lê o que a conversa com a TrIA guardou em sessionStorage ("spm_triagem").
import { exigirLogin, PERFIS } from "../core/guard.js";
import { h, $ } from "../core/dom.js";
import { barraPac, iconePac } from "../ui/fluxoPaciente.js";
import { montarNavPaciente, definirSelo } from "../ui/navPaciente.js";
import { orientar, MENSAGEM_URGENCIA, PADRAO_DA_AREA } from "../core/triagem.js";
import { especialidadeService } from "../services/especialidadeService.js";
import { agendamentoService, contarConsultasEmAberto } from "../services/agendamentoService.js";
import { hojeISO, agoraHHMM } from "../core/datetime.js";
import { registrarPwa } from "../pwa.js";

const ROTULO_AREA = { ORTOPEDIA: "Ortopedia", FISIOTERAPIA: "Fisioterapia" };

function lerTriagem() {
  try {
    const t = JSON.parse(sessionStorage.getItem("spm_triagem"));
    return t && typeof t === "object" ? { texto: String(t.texto ?? ""), rapidas: Array.isArray(t.rapidas) ? t.rapidas : [], audios: Number(t.audios) || 0 } : null;
  } catch {
    return null;
  }
}

async function iniciar(sessao) {
  registrarPwa();
  const triagem = lerTriagem();
  // Quem chega direto aqui, sem ter conversado com a TrIA, volta para a conversa.
  if (!triagem || (!triagem.texto.trim() && triagem.rapidas.length === 0 && triagem.audios === 0)) {
    location.replace("pretriagem.html");
    return;
  }
  $("#barra").replaceChildren(barraPac("Resultado da triagem", "pretriagem.html"));
  montarNavPaciente("inicio");

  const { area, urgente } = orientar({ texto: triagem.texto, rapidas: triagem.rapidas });
  const soAudio = !triagem.texto.trim() && triagem.rapidas.length === 0;

  // Liga a área sugerida à especialidade cadastrada na API (se existir) para pré-selecionar no agendamento.
  let esp = null;
  try {
    esp = (await especialidadeService.listar()).find((e) => PADRAO_DA_AREA[area].test(e.nome)) ?? null;
  } catch {
    /* sem rede: segue sem pré-seleção */
  }
  const nome = esp?.nome ?? ROTULO_AREA[area];
  const agendarHref = esp ? `agendamento.html?especialidade=${esp.id}` : "agendamento.html";

  $("#conteudo").replaceChildren(
    h("h1", { class: "pac-h1", tabindex: "-1" }, "Seu resultado está pronto"),
    h("p", { class: "pac-res__sub" }, "Veja abaixo a orientação da TrIA para o seu atendimento."),
    h("img", { class: "pac-res__pessoa", src: "icons/pac/pessoa-resultado.svg", alt: "", width: "112", height: "112" }),
    h("div", { class: "pac-res__ok", role: "status" }, iconePac("analise-ok"), "Análise concluída!"),
    h("p", { class: "pac-res__texto" }, "Com base nas informações que você contou, podemos ajudar você a encontrar um atendimento adequado."),
    h(
      "section",
      { class: "pac-orient", "aria-label": "Orientação da IA" },
      h("span", { class: "pac-orient__icone" }, iconePac("estrela")),
      h(
        "div",
        {},
        h("p", { class: "pac-orient__rotulo" }, "Orientação da IA"),
        h("p", { class: "pac-orient__nome" }, nome),
        h("p", { class: "pac-orient__texto" }, "Esse atendimento pode ajudar a avaliar os sintomas que você informou."),
        soAudio
          ? h("p", { class: "pac-orient__aviso", id: "aviso-audio" }, "Seu áudio fica só neste aparelho e ainda não entra na análise. Sem texto nem opções, indicamos a avaliação ortopédica como porta de entrada.")
          : null,
        urgente ? h("p", { class: "pac-orient__urgente", role: "alert" }, MENSAGEM_URGENCIA) : null,
      ),
    ),
    h(
      "div",
      { class: "pac-res__acoes" },
      h("a", { class: "pac-btn", id: "ver-clinicas", href: "clinicas.html" }, "Ver clínicas"),
      h("a", { class: "pac-btn pac-btn--contorno", id: "agendar", href: agendarHref }, "Agendar atendimento"),
      h("a", { class: "pac-btn pac-btn--claro", id: "refazer", href: "pretriagem.html" }, "Refazer triagem"),
    ),
    h(
      "p",
      { class: "pac-res__medico" },
      h("img", { src: "icons/pac/aviso.png", alt: "", width: "16", height: "16" }),
      "Esta orientação não substitui uma avaliação de um profissional de saúde.",
    ),
  );
  window.scrollTo(0, 0);

  // O selo é um complemento: se a API estiver fora, a tela continua sem ele.
  try {
    if (sessao.idPaciente) {
      const todos = await agendamentoService.listar();
      definirSelo("consultas", contarConsultasEmAberto(todos, Number(sessao.idPaciente), hojeISO(), agoraHHMM()));
    }
  } catch {
    /* sem selo */
  }
}

const sessao = exigirLogin([PERFIS.PACIENTE]);
if (sessao) iniciar(sessao);
