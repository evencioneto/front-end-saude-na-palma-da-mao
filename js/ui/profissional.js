// Peças visuais do módulo do profissional (barra superior, barra inferior, ícones e selos).
import { h } from "../core/dom.js";

// Ícones exportados do Figma (icons/pro/*.svg), usados como <img> no tamanho do design.
export function icone(nome, tamanho = 20) {
  return h("img", { src: `icons/pro/${nome}.svg`, alt: "", width: String(tamanho), height: String(tamanho), "aria-hidden": "true" });
}

// Barra superior das telas internas: voltar (círculo verde claro), título e cruz (círculo verde claro).
export function barraProf(titulo) {
  const voltar = h(
    "button",
    {
      class: "prof-voltar",
      type: "button",
      "aria-label": "Voltar",
      onclick: () => (history.length > 1 ? history.back() : (location.href = "prof-home.html")),
    },
    icone("seta-esquerda", 20),
  );
  return h(
    "header",
    { class: "prof-barra" },
    voltar,
    h("h1", { class: "prof-barra__titulo" }, titulo),
    h("span", { class: "prof-logo" }, icone("cruz-topo", 18)),
  );
}

// ---- Selos da barra inferior (guardados na sessão do navegador para aparecerem em todas as telas) ----
const CHAVE_SELOS = "spm_prof_selos";

export function lerSelos() {
  try {
    return { agenda: 0, notificacoes: 0, ...JSON.parse(sessionStorage.getItem(CHAVE_SELOS)) };
  } catch {
    return { agenda: 0, notificacoes: 0 };
  }
}

export function salvarSelos(selos) {
  try {
    sessionStorage.setItem(CHAVE_SELOS, JSON.stringify(selos));
  } catch {
    /* armazenamento indisponível: o selo só some até a próxima carga */
  }
  atualizarSelosNaTela(selos);
}

function atualizarSelosNaTela(selos) {
  for (const [chave, valor] of Object.entries(selos)) {
    const el = document.querySelector(`[data-selo="${chave}"]`);
    if (!el) continue;
    el.textContent = valor > 9 ? "9+" : String(valor);
    el.hidden = !(valor > 0);
  }
}

const ITENS = [
  { chave: "inicio", href: "prof-home.html", rotulo: "Início" },
  { chave: "agenda", href: "prof-agenda.html", rotulo: "Agenda" },
  { chave: "notificacoes", href: "prof-notificacoes.html", rotulo: "Notificações" },
  { chave: "perfil", href: "prof-perfil.html", rotulo: "Perfil" },
];

export function montarNavProf(ativa) {
  const selos = lerSelos();
  const nav = h(
    "nav",
    { class: "prof-nav", "aria-label": "Principal" },
    ITENS.map((i) => {
      const atual = i.chave === ativa;
      return h(
        "a",
        { href: i.href, "aria-current": atual ? "page" : false },
        h(
          "span",
          { class: "prof-nav__icone" },
          icone(`nav-${i.chave}${atual ? "-ativo" : ""}`, 22),
          i.chave in selos
            ? h("span", { class: "prof-selo", "data-selo": i.chave, hidden: !(selos[i.chave] > 0) }, String(selos[i.chave] > 9 ? "9+" : selos[i.chave]))
            : null,
        ),
        h("span", {}, i.rotulo),
      );
    }),
  );
  document.body.classList.add("com-nav-prof");
  document.body.append(nav);
  return nav;
}

// "2026-10-25" -> "25/10/2026"
export const dataBR = (iso) => iso.split("-").reverse().join("/");

export const maiuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);
