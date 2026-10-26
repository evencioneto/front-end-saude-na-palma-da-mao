// Peças visuais do módulo do administrador (barra superior, barra inferior, ícones, selos).
import { h } from "../core/dom.js";

// Ícones exportados do Figma (icons/adm/*.svg). Cada SVG já traz o tamanho real do ícone no design.
export function icone(nome) {
  return h("img", { src: `icons/adm/${nome}.svg`, alt: "", "aria-hidden": "true" });
}

// Cabeçalho de listas: voltar + título à esquerda e, opcionalmente, o botão "Adicionar" à direita.
export function cabecalhoLista(titulo, { voltarPara = "adm-home.html", adicionar, subtitulo } = {}) {
  return h(
    "header",
    { class: "adm-lista__topo" },
    h("a", { class: "adm-voltar", href: voltarPara, "aria-label": "Voltar" }, icone("seta-esquerda")),
    subtitulo
      ? h("div", { class: "adm-lista__titulos" }, h("h1", { class: "adm-lista__titulo" }, titulo), h("p", { class: "adm-lista__sub" }, subtitulo))
      : h("h1", { class: "adm-lista__titulo" }, titulo),
    typeof adicionar === "function"
      ? h("button", { class: "adm-adicionar", type: "button", onclick: adicionar }, icone("mais-branco"), "Adicionar")
      : adicionar
        ? h("a", { class: "adm-adicionar", href: adicionar }, icone("mais-branco"), "Adicionar")
        : null,
  );
}

// Barra superior das telas de formulário: voltar, título centralizado e cruz.
export function barraAdm(titulo, voltarPara) {
  return h(
    "header",
    { class: "adm-barra" },
    h(
      "button",
      {
        class: "adm-voltar",
        type: "button",
        "aria-label": "Voltar",
        onclick: () => (history.length > 1 ? history.back() : (location.href = voltarPara)),
      },
      icone("seta-esquerda"),
    ),
    h("h1", { class: "adm-barra__titulo" }, titulo),
    h("span", { class: "adm-logo" }, icone("cruz-topo")),
  );
}

const ITENS = [
  { chave: "inicio", href: "adm-home.html", rotulo: "Início" },
  { chave: "clinicas", href: "adm-clinicas.html", rotulo: "Clínicas" },
  { chave: "notificacoes", href: "adm-notificacoes.html", rotulo: "Notificações" },
  { chave: "perfil", href: "adm-perfil.html", rotulo: "Perfil" },
];

// Barra inferior fixa. `ativa` = chave do item atual. `avisos` = número no selo vermelho (0 = sem selo).
export function montarNavAdm(ativa, avisos = 0) {
  const nav = h(
    "nav",
    { class: "adm-nav", "aria-label": "Principal" },
    ITENS.map((i) => {
      const atual = i.chave === ativa;
      const nome = i.chave === "clinicas" ? "nav-clinicas" : `nav-${i.chave}${atual && i.chave !== "clinicas" ? "-ativo" : ""}`;
      const conteudo = [
        h(
          "span",
          { class: "adm-nav__icone" },
          icone(nome),
          i.chave === "notificacoes" ? h("span", { class: "adm-selo", "data-selo": "notificacoes", hidden: !(avisos > 0) }, avisos > 0 ? (avisos > 9 ? "9+" : String(avisos)) : "") : null,
        ),
        h("span", {}, i.rotulo),
      ];
      return h("a", { href: i.href, "aria-current": atual ? "page" : false }, conteudo);
    }),
  );
  document.body.classList.add("com-nav-adm");
  document.body.append(nav);
  return nav;
}

// "Dr. Carlos Menezes" -> "CM"; "Dra. Ana Paula Ferreira" -> "AF" (primeira e última palavra do nome).
export function iniciaisNome(nome) {
  const p = String(nome ?? "").replace(/^(dr|dra)\.?\s+/i, "").split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

// Remove acentos e caixa para a busca ("clinica" encontra "Clínica").
export const normalizar = (t) =>
  String(t ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// Aviso de erro e estado vazio no padrão das telas do administrador.
export const avisoAdm = (texto) => h("p", { class: "adm-aviso", role: "alert" }, texto);
export const vazioAdm = (texto) => h("p", { class: "adm-vazio" }, texto);

// Ícone de cada especialidade do catálogo (icons/adm/esp-*.svg); nomes fora do catálogo usam a cruz padrão.
const ICONES_ESP = {
  ortopedia: "esp-ortopedia",
  traumatologia: "esp-traumatologia",
  "fisioterapia ortopedica": "esp-fisio-ortopedica",
  "fisioterapia esportiva": "esp-fisio-esportiva",
  coluna: "esp-coluna",
  joelho: "esp-joelho",
  ombro: "esp-ombro",
  "mao e punho": "esp-mao-punho",
};
export const iconeEspecialidade = (nome) => icone(ICONES_ESP[normalizar(nome).trim()] ?? "cruz-lista");

// Folha de confirmação que sobe do rodapé. `aoConfirmar` pode ser assíncrona: se lançar erro, a mensagem
// aparece na folha e ela continua aberta. Devolve uma Promise<boolean> (true = confirmou e deu certo).
export function folhaConfirmar({ titulo, texto, textoOk = "Confirmar", textoCancelar = "Cancelar", aoConfirmar }) {
  return new Promise((resolve) => {
    const fechar = (valor) => {
      if (dlg.open) dlg.close();
      dlg.remove();
      resolve(valor);
    };
    const erro = h("p", { class: "adm-folha__erro", role: "alert" });
    const cancelar = h("button", { class: "adm-folha__cancelar", type: "button", onclick: () => fechar(false) }, textoCancelar);
    const ok = h("button", { class: "adm-folha__ok", type: "button" }, textoOk);
    ok.addEventListener("click", async () => {
      erro.textContent = "";
      ok.disabled = cancelar.disabled = true;
      try {
        await aoConfirmar?.();
        fechar(true);
      } catch (e) {
        erro.textContent = e.message;
        ok.disabled = cancelar.disabled = false;
      }
    });
    const dlg = h(
      "dialog",
      { class: "adm-folha", "aria-labelledby": "folha-titulo", "aria-describedby": "folha-texto" },
      h("h2", { class: "adm-folha__titulo", id: "folha-titulo" }, titulo),
      h("p", { class: "adm-folha__texto", id: "folha-texto" }, texto),
      h("div", { class: "adm-folha__acoes" }, cancelar, ok),
      erro,
    );
    dlg.addEventListener("cancel", (ev) => {
      if (ok.disabled) return ev.preventDefault();
      fechar(false);
    });
    document.body.append(dlg);
    dlg.showModal();
    cancelar.focus();
  });
}

// Campo de formulário (rótulo + entrada + mensagem de erro). `tag` = "input" (padrão) ou "textarea".
export function campoAdm(id, rotulo, atributos = {}, tag = "input") {
  const entrada = h(tag, { id, name: id, autocomplete: "off", ...(tag === "input" ? { type: "text" } : {}), ...atributos });
  const erro = h("p", { class: "adm-campo__erro", id: `${id}-erro`, role: "alert" });
  entrada.setAttribute("aria-describedby", `${id}-erro`);
  return { input: entrada, erro, el: h("div", { class: "adm-campo" }, h("label", { for: id }, rotulo), entrada, erro) };
}

// Linha "Status ativo" com chave liga/desliga. `estado()` devolve o valor; `definir(v)` altera.
export function linhaStatus(inicial = true) {
  let ativo = inicial;
  const chave = h("button", { class: "adm-chave", type: "button", role: "switch", "aria-checked": String(ativo), "aria-labelledby": "rot-status" });
  chave.addEventListener("click", () => {
    ativo = !ativo;
    chave.setAttribute("aria-checked", String(ativo));
  });
  return {
    el: h("div", { class: "adm-status" }, h("span", { id: "rot-status" }, "Status ativo"), chave),
    estado: () => ativo,
    definir: (v) => {
      ativo = Boolean(v);
      chave.setAttribute("aria-checked", String(ativo));
    },
  };
}
