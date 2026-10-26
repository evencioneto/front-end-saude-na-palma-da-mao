// Editar perfil: nome, telefone e e-mail do paciente (PUT /usuarios/:id). A foto ainda não tem suporte na API.
import { exigirLogin, PERFIS } from "../core/guard.js";
import { usuarioApi } from "../services/usuarioService.js";
import { sessao as sessaoLocal } from "../core/session.js";
import { h, $, toast, comBotaoOcupado } from "../core/dom.js";
import { barraPac } from "../ui/fluxoPaciente.js";
import { iniciais } from "../ui/fluxo.js";
import { aplicarMascara, formatarTelefone, apenasDigitos } from "../ui/mascaras.js";
import { registrarPwa } from "../pwa.js";

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function campo({ id, rotulo, tipo = "text", autocomplete, inputmode, valor = "" }) {
  const input = h("input", { id, class: "pac-input", type: tipo, autocomplete, inputmode, value: valor, "aria-describedby": `${id}-erro` });
  const erro = h("p", { class: "pac-erro", id: `${id}-erro`, role: "alert", hidden: true });
  return { input, erro, el: h("div", { class: "pac-editar__campo" }, h("label", { for: id }, rotulo), input, erro) };
}

function mostrarErro(c, msg) {
  c.erro.textContent = msg ?? "";
  c.erro.hidden = !msg;
  if (msg) c.input.setAttribute("aria-invalid", "true");
  else c.input.removeAttribute("aria-invalid");
  return !msg;
}

async function iniciar(s) {
  registrarPwa();
  $("#barra").replaceChildren(barraPac("Editar perfil", "perfil.html"));

  const nome = campo({ id: "e-nome", rotulo: "Nome completo", autocomplete: "name", valor: s.nome ?? "" });
  const telefone = campo({ id: "e-telefone", rotulo: "Telefone", tipo: "tel", autocomplete: "tel", inputmode: "tel" });
  const email = campo({ id: "e-email", rotulo: "E-mail", tipo: "email", autocomplete: "email", valor: s.email ?? "" });
  aplicarMascara(telefone.input, formatarTelefone);

  const salvar = h("button", { class: "pac-btn", id: "salvar", type: "submit" }, "Salvar alterações");
  const form = h("form", { class: "pac-editar__form", novalidate: true }, nome.el, telefone.el, email.el, salvar);

  $("#conteudo").replaceChildren(
    h("div", { class: "pac-editar__foto" }, h("span", { class: "pac-avatar-grande pac-avatar-grande--foto", "aria-hidden": "true" }, iniciais(s.nome)),
      h("button", { class: "pac-link", id: "alterar-foto", type: "button", onclick: () => toast("A troca de foto estará disponível em breve.") }, "Alterar foto")),
    form,
  );

  // O telefone não fica na sessão: busca o cadastro para preencher o campo.
  try {
    const u = await usuarioApi.buscar(s.idUsuario);
    if (u && !telefone.input.value) telefone.input.value = formatarTelefone(u.telefone ?? "");
  } catch {
    /* segue com o campo vazio */
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const n = nome.input.value.trim().replace(/\s+/g, " ");
    const t = apenasDigitos(telefone.input.value);
    const m = email.input.value.trim().toLowerCase();
    const ok = [
      mostrarErro(nome, n.length < 3 ? "Informe seu nome completo." : ""),
      mostrarErro(telefone, t && t.length < 10 ? "Informe o telefone com DDD." : ""),
      mostrarErro(email, EMAIL_OK.test(m) ? "" : "Informe um e-mail válido."),
    ].every(Boolean);
    if (!ok) {
      form.querySelector("[aria-invalid=true]")?.focus();
      return;
    }
    try {
      await comBotaoOcupado(salvar, "Salvando...", () => usuarioApi.atualizar(s.idUsuario, { nome: n, email: m, telefone: t || null }));
      sessaoLocal.atualizar({ nome: n, email: m });
      toast("Perfil atualizado.", "sucesso");
      setTimeout(() => location.assign("perfil.html"), 600);
    } catch (err) {
      toast(err.message, "erro");
    }
  });
}

const sessao = exigirLogin([PERFIS.PACIENTE]);
if (sessao) iniciar(sessao);
