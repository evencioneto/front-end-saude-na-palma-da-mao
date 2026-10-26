// Resultado da pré-triagem: orientação inicial (sem diagnóstico) e caminho para o agendamento.
// Lê o que a conversa com a TrIA guardou em sessionStorage ("spm_triagem").
// A tela de resultado ainda está no desenho antigo: será refeita quando o Figma dela chegar.
import { exigirLogin, PERFIS } from "../core/guard.js";
import { h, $ } from "../core/dom.js";
import { barraFluxo } from "../ui/fluxo.js";
import { montarNavInferior } from "../ui/navInferior.js";
import { orientar, MENSAGEM_URGENCIA, PADRAO_DA_AREA } from "../core/triagem.js";
import { especialidadeService } from "../services/especialidadeService.js";
import { registrarPwa } from "../pwa.js";

const ROTULO_AREA = { ORTOPEDIA: "Ortopedia", FISIOTERAPIA: "Fisioterapia" };
const ICONE_AREA = { ORTOPEDIA: "icons/ui/esp-ortopedia.png", FISIOTERAPIA: "icons/ui/esp-reabilitacao.png" };

function lerTriagem() {
  try {
    const t = JSON.parse(sessionStorage.getItem("spm_triagem"));
    return t && typeof t === "object" ? { texto: String(t.texto ?? ""), rapidas: Array.isArray(t.rapidas) ? t.rapidas : [], audios: Number(t.audios) || 0 } : null;
  } catch {
    return null;
  }
}

async function iniciar() {
  registrarPwa();
  const triagem = lerTriagem();
  // Quem chega direto aqui, sem ter conversado com a TrIA, volta para a conversa.
  if (!triagem || (!triagem.texto.trim() && triagem.rapidas.length === 0 && triagem.audios === 0)) {
    location.replace("pretriagem.html");
    return;
  }
  $("#barra").replaceChildren(barraFluxo("Pré-triagem", "pretriagem.html"));

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

  $("#conteudo").className = "fluxo fluxo--sem-rodape";
  $("#conteudo").replaceChildren(
    h("img", { class: "resultado__ilustracao", src: "icons/ui/profissional-triagem.png", alt: "", width: "309", height: "309" }),
    h("div", { class: "faixa-ok", role: "status" }, h("img", { src: "icons/ui/ok.svg", alt: "", width: "20", height: "20" }), "Análise concluída!"),
    h("p", { class: "resultado__texto" }, "Com base nas informações que você contou, podemos ajudar você a encontrar um atendimento adequado."),
    h(
      "section",
      { class: "orientacao", "aria-label": "Orientação inicial" },
      h(
        "div",
        { class: "orientacao__topo" },
        h("span", { class: "orientacao__icone" }, h("img", { src: ICONE_AREA[area], alt: "", width: "40", height: "40" })),
        h("div", {}, h("p", { class: "orientacao__rotulo" }, "Orientação inicial"), h("p", { class: "orientacao__nome" }, nome)),
      ),
      h("p", { class: "orientacao__texto" }, "Esse atendimento pode ajudar a avaliar os sintomas que você informou."),
      soAudio
        ? h("p", { class: "orientacao__texto", id: "aviso-audio" }, "Seu áudio fica só neste aparelho e ainda não entra na análise. Sem texto nem opções, indicamos a avaliação ortopédica como porta de entrada.")
        : null,
      urgente ? h("p", { class: "orientacao__urgente", role: "alert" }, MENSAGEM_URGENCIA) : null,
      h(
        "div",
        { class: "orientacao__acoes" },
        h("a", { class: "btn", id: "agendar", href: agendarHref }, "Agendar atendimento"),
        h("a", { class: "btn btn--contorno", id: "refazer", href: "pretriagem.html" }, "Refazer triagem"),
      ),
    ),
    h(
      "p",
      { class: "aviso-medico" },
      h("img", { src: "icons/ui/aviso.png", alt: "", width: "30", height: "30" }),
      "Esta orientação não substitui uma avaliação de um profissional médico.",
    ),
  );
  montarNavInferior("inicio");
  window.scrollTo(0, 0);
}

const sessao = exigirLogin([PERFIS.PACIENTE]);
if (sessao) iniciar();
