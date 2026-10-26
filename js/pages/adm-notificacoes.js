// Preferências de notificação do administrador.
// O back-end ainda não tem tabela de preferências: as escolhas ficam salvas só neste aparelho (localStorage).
import { exigirLogin, PERFIS } from "../core/guard.js";
import { h, $ } from "../core/dom.js";
import { registrarPwa } from "../pwa.js";
import { barraAdm, montarNavAdm } from "../ui/admin.js";

const OPCOES = [
  { chave: "confirmacoes", titulo: "Confirmações de consulta", texto: "Receba notificações quando uma consulta for confirmada", padrao: true },
  { chave: "lembretes", titulo: "Lembretes", texto: "Lembrete 24h antes da sua consulta", padrao: true },
  { chave: "novidades", titulo: "Novidades", texto: "Informações sobre novas funcionalidades", padrao: false },
];

const guardada = (idUsuario) => `spm_adm_notificacoes_${idUsuario}`;
function ler(idUsuario) {
  try {
    return JSON.parse(localStorage.getItem(guardada(idUsuario))) ?? {};
  } catch {
    return {};
  }
}
function gravar(idUsuario, valores) {
  try {
    localStorage.setItem(guardada(idUsuario), JSON.stringify(valores));
  } catch {
    /* sem armazenamento (modo privado): a escolha vale só até sair da tela */
  }
}

function iniciar(s) {
  registrarPwa();
  const valores = { ...Object.fromEntries(OPCOES.map((o) => [o.chave, o.padrao])), ...ler(s.idUsuario) };
  const cartoes = OPCOES.map((o) => {
    const chave = h("button", { class: "adm-chave", type: "button", role: "switch", "aria-checked": String(Boolean(valores[o.chave])), "aria-labelledby": `n-${o.chave}`, "aria-describedby": `d-${o.chave}` });
    chave.addEventListener("click", () => {
      valores[o.chave] = !valores[o.chave];
      chave.setAttribute("aria-checked", String(valores[o.chave]));
      gravar(s.idUsuario, valores);
    });
    return h(
      "article",
      { class: "adm-cartao adm-config" },
      h("div", { class: "adm-config__texto" }, h("h2", { class: "adm-cartao__nome", id: `n-${o.chave}` }, o.titulo), h("p", { id: `d-${o.chave}` }, o.texto)),
      chave,
    );
  });
  $("#conteudo").replaceChildren(barraAdm("Notificações", "adm-home.html"), h("div", { class: "adm-corpo adm-corpo--topo" }, h("div", { class: "adm-cartoes adm-cartoes--config" }, cartoes)));
  montarNavAdm("notificacoes");
}

const sessao = exigirLogin([PERFIS.ADMIN]);
if (sessao) iniciar(sessao);
