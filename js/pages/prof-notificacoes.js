// Preferências de notificação do profissional.
// Ainda não existe endpoint no back-end: as escolhas ficam só neste navegador (localStorage).
import { exigirLogin, PERFIS } from "../core/guard.js";
import { h, $ } from "../core/dom.js";
import { registrarPwa } from "../pwa.js";
import { barraProf, montarNavProf } from "../ui/profissional.js";

const CHAVE = "spm_prof_notificacoes";
const ITENS = [
  { id: "confirmacoes", titulo: "Confirmações de consulta", texto: "Receba notificações quando uma consulta for confirmada", padrao: true },
  { id: "lembretes", titulo: "Lembretes", texto: "Lembrete 24h antes da sua consulta", padrao: true },
  { id: "novidades", titulo: "Novidades", texto: "Informações sobre novas funcionalidades", padrao: false },
];

function ler() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE)) ?? {};
  } catch {
    return {};
  }
}
function gravar(estado) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado));
  } catch {
    /* armazenamento indisponível: vale só até recarregar */
  }
}

function iniciar() {
  registrarPwa();
  const estado = ler();

  const linha = (i) => {
    const ligado = estado[i.id] ?? i.padrao;
    const chave = h("button", {
      class: "prof-chave",
      type: "button",
      role: "switch",
      "aria-checked": String(ligado),
      "aria-labelledby": `n-${i.id}`,
    });
    chave.addEventListener("click", () => {
      const novo = chave.getAttribute("aria-checked") !== "true";
      chave.setAttribute("aria-checked", String(novo));
      estado[i.id] = novo;
      gravar(estado);
    });
    return h(
      "div",
      { class: "prof-cartao prof-pref" },
      h("div", { class: "prof-pref__texto" }, h("strong", { id: `n-${i.id}` }, i.titulo), h("span", {}, i.texto)),
      chave,
    );
  };

  $("#conteudo").replaceChildren(
    barraProf("Notificações"),
    h("div", { class: "prof-corpo" }, h("div", { class: "prof-lista" }, ITENS.map(linha))),
  );
  montarNavProf("notificacoes");
}

const sessao = exigirLogin([PERFIS.PROFISSIONAL]);
if (sessao) iniciar();
