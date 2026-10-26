// Campo de formulário no visual do paciente: rótulo, entrada e mensagem de erro (lida por leitor de tela).
import { h } from "../core/dom.js";

export function campo({ id, rotulo, tipo = "text", autocomplete, inputmode, valor = "", placeholder, minlength }) {
  const input = h("input", { id, class: "pac-input", type: tipo, autocomplete, inputmode, value: valor, placeholder, minlength, "aria-describedby": `${id}-erro` });
  const erro = h("p", { class: "pac-erro", id: `${id}-erro`, role: "alert", hidden: true });
  return { input, erro, el: h("div", { class: "pac-editar__campo" }, h("label", { for: id }, rotulo), input, erro) };
}

// Mostra (ou limpa, se msg for vazia) o erro do campo. Retorna true quando não há erro.
export function mostrarErro(c, msg) {
  c.erro.textContent = msg ?? "";
  c.erro.hidden = !msg;
  if (msg) c.input.setAttribute("aria-invalid", "true");
  else c.input.removeAttribute("aria-invalid");
  return !msg;
}
