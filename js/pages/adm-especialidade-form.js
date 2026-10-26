// Formulário "Nova especialidade".
import { exigirLogin, PERFIS } from "../core/guard.js";
import { h, $, toast } from "../core/dom.js";
import { registrarPwa } from "../pwa.js";
import { especialidadeService } from "../services/especialidadeService.js";
import { barraAdm, campoAdm, linhaStatus, normalizar, avisoAdm } from "../ui/admin.js";

async function iniciar() {
  registrarPwa();
  const nome = campoAdm("nome", "Nome da especialidade", { placeholder: "Ex: Ortopedia", required: true, maxlength: "100" });
  const descricao = campoAdm("descricao", "Descrição", { placeholder: "Descreva a especialidade...", maxlength: "255" }, "textarea");
  const status = linhaStatus(true);
  const salvar = h("button", { class: "adm-salvar", type: "submit" }, "Salvar especialidade");
  const aviso = h("div", { "aria-live": "polite" });
  const form = h("form", { class: "adm-form", novalidate: true }, nome.el, descricao.el, status.el, aviso, salvar);
  $("#conteudo").replaceChildren(barraAdm("Nova especialidade", "adm-especialidades.html"), form);

  let existentes = [];
  especialidadeService
    .listar({ apenasAtivas: false })
    .then((l) => (existentes = l))
    .catch(() => {}); // a checagem de nome repetido é só um atalho: o back-end também recusa duplicados

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    nome.erro.textContent = "";
    aviso.replaceChildren();
    const nomeValor = nome.input.value.trim();
    if (!nomeValor) {
      nome.erro.textContent = "Informe o nome da especialidade.";
      return nome.input.focus();
    }
    if (existentes.some((e) => normalizar(e.nome).trim() === normalizar(nomeValor))) {
      nome.erro.textContent = "Já existe uma especialidade com este nome.";
      return nome.input.focus();
    }
    salvar.disabled = true;
    salvar.textContent = "Salvando...";
    try {
      await especialidadeService.criar({ nome: nomeValor, descricao: descricao.input.value.trim(), ativo: status.estado() });
      toast("Especialidade cadastrada.", "sucesso");
      setTimeout(() => (location.href = "adm-especialidades.html"), 700);
    } catch (erro) {
      aviso.replaceChildren(avisoAdm(/unique|duplic|already|nome/i.test(erro.message) ? "Já existe uma especialidade com este nome." : erro.message));
      salvar.disabled = false;
      salvar.textContent = "Salvar especialidade";
    }
  });
}

const sessao = exigirLogin([PERFIS.ADMIN]);
if (sessao) iniciar();
