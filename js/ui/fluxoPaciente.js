// Peças do fluxo do paciente no design novo (resultado da triagem e agendamento): barra superior, passos, busca e rodapé.
import { h } from "../core/dom.js";

const icone = (nome, tam = 24) => h("img", { src: `icons/pac/${nome}.svg`, alt: "", width: String(tam), height: String(tam) });

// Barra superior: voltar (função ou href), título centralizado e a marca. A marca é só decorativa.
export function barraPac(titulo, aoVoltar) {
  const voltar =
    typeof aoVoltar === "string"
      ? h("a", { class: "pac-voltar", href: aoVoltar, "aria-label": "Voltar" }, icone("voltar"))
      : h("button", { class: "pac-voltar", type: "button", "aria-label": "Voltar", onclick: aoVoltar }, icone("voltar"));
  return h(
    "header",
    { class: "pac-bar" },
    voltar,
    h("p", { class: "pac-bar__titulo" }, titulo),
    h("span", { class: "pac-bar__marca", "aria-hidden": "true" }, icone("cruz-topo")),
  );
}

// Indicador de passos: feito (com check), atual (preenchido) e os próximos (cinza).
export function passosPac(atual, total = 6) {
  return h(
    "ol",
    { class: "pac-passos", "aria-label": `Passo ${atual + 1} de ${total}` },
    Array.from({ length: total }, (_, i) =>
      h(
        "li",
        { "data-estado": i === atual ? "atual" : i < atual ? "feito" : "", "aria-current": i === atual ? "step" : false },
        i < atual ? icone("passo-ok") : h("span", {}, String(i + 1)),
      ),
    ),
  );
}

// Campo de busca. Chama aoDigitar(texto) a cada tecla.
export function buscaPac(placeholder, aoDigitar) {
  return h("input", {
    type: "search",
    class: "pac-busca",
    placeholder,
    "aria-label": placeholder.replace(/\.+$/, ""),
    autocomplete: "off",
    oninput: (e) => aoDigitar(e.target.value),
  });
}

// Rodapé fixo: Voltar (contorno) e Continuar (cheio). Retorna { el, continuar }.
export function rodapePac({ aoVoltar, aoContinuar, rotulo = "Continuar", habilitado = false, embutido = false }) {
  const continuar = h("button", { class: "pac-btn", type: "button", onclick: aoContinuar, disabled: !habilitado }, rotulo);
  const el = h(
    "div",
    { class: embutido ? "pac-rodape pac-rodape--embutido" : "pac-rodape" },
    h("button", { class: "pac-btn pac-btn--contorno", type: "button", onclick: aoVoltar }, "Voltar"),
    continuar,
  );
  return { el, continuar };
}

export { icone as iconePac };
