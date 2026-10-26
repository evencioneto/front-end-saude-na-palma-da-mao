// Confirmação no visual do paciente (usa <dialog>, acessível e fechável com Esc).
import { h } from "../core/dom.js";

export function confirmarPac(mensagem, textoOk = "Confirmar", textoVoltar = "Voltar") {
  return new Promise((resolve) => {
    const fechar = (valor) => {
      if (dlg.open) dlg.close();
      dlg.remove();
      resolve(valor);
    };
    const dlg = h(
      "dialog",
      { class: "pac-dialogo", "aria-labelledby": "pac-dlg-msg" },
      h(
        "div",
        { class: "pac-dialogo__corpo" },
        h("p", { id: "pac-dlg-msg", class: "pac-dialogo__msg" }, mensagem),
        h(
          "div",
          { class: "pac-dialogo__acoes" },
          h("button", { class: "pac-btn pac-btn--perigo", type: "button", onclick: () => fechar(true) }, textoOk),
          h("button", { class: "pac-btn pac-btn--contorno", type: "button", onclick: () => fechar(false) }, textoVoltar),
        ),
      ),
    );
    dlg.addEventListener("cancel", () => fechar(false));
    document.body.append(dlg);
    dlg.showModal();
  });
}
