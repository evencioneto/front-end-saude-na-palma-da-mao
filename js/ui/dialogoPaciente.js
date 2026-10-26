// Folha de confirmação no visual do paciente (usa <dialog>, acessível e fechável com Esc).
import { h } from "../core/dom.js";

const icone = (nome, tam) => h("img", { src: `icons/pac/${nome}.svg`, alt: "", width: String(tam), height: String(tam) });

// Pergunta se o paciente quer mesmo cancelar a consulta. Resolve true (cancelar) ou false (voltar).
export function confirmarCancelamento() {
  return new Promise((resolve) => {
    const fechar = (valor) => {
      if (dlg.open) dlg.close();
      dlg.remove();
      resolve(valor);
    };
    const dlg = h(
      "dialog",
      { class: "pac-folha", "aria-labelledby": "pac-folha-titulo", "aria-describedby": "pac-folha-msg" },
      h(
        "div",
        { class: "pac-folha__corpo" },
        icone("lixeira", 56),
        h("h2", { id: "pac-folha-titulo", class: "pac-folha__titulo" }, "Cancelar consulta?"),
        h("p", { id: "pac-folha-msg", class: "pac-folha__msg" }, "Você tem certeza que deseja cancelar esta consulta? Esta ação não pode ser desfeita."),
        h("p", { class: "pac-folha__aviso", role: "note" }, "Atenção: o cancelamento só pode ser realizado com, no mínimo, 24 horas de antecedência."),
        h("button", { class: "pac-btn pac-btn--perigo", type: "button", onclick: () => fechar(true) }, "Sim, cancelar consulta"),
        h("button", { class: "pac-btn pac-btn--claro", type: "button", onclick: () => fechar(false) }, "Voltar"),
      ),
    );
    dlg.addEventListener("cancel", () => fechar(false));
    dlg.addEventListener("click", (ev) => {
      if (ev.target === dlg) fechar(false); // toque fora da folha
    });
    document.body.append(dlg);
    dlg.showModal();
  });
}
