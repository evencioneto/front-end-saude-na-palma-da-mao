// Especialidades (paciente): lista com busca. Cada cartão leva ao detalhe da especialidade.
import { exigirLogin, PERFIS } from "../core/guard.js";
import { h, $ } from "../core/dom.js";
import { avisoDeErro } from "../ui/layout.js";
import { barraPac, buscaPac, iconePac } from "../ui/fluxoPaciente.js";
import { montarNavPaciente } from "../ui/navPaciente.js";
import { normalizar } from "../ui/fluxo.js";
import { carregarCatalogo } from "../ui/catalogo.js";
import { iconeEspecialidade } from "../ui/iconesEspecialidade.js";
import { registrarPwa } from "../pwa.js";

let itens = [];
let texto = "";

const cartao = (e) =>
  h(
    "a",
    { class: "pac-opcao pac-esp", href: `especialidade.html?id=${e.id}` },
    h("span", { class: "pac-esp__icone" }, iconePac(iconeEspecialidade(e.nome))),
    h("span", { class: "pac-esp__nome" }, e.nome),
    e.descricao ? h("span", { class: "pac-esp__desc" }, e.descricao) : null,
  );

function desenharLista(lista) {
  const alvo = normalizar(texto);
  const visiveis = itens.filter((e) => !alvo || normalizar(`${e.nome} ${e.descricao}`).includes(alvo));
  lista.replaceChildren(...(visiveis.length ? visiveis.map(cartao) : [h("p", { class: "pac-vazio" }, "Nenhuma especialidade encontrada.")]));
  lista.setAttribute("aria-label", `${visiveis.length} especialidade${visiveis.length === 1 ? "" : "s"}`);
}

async function iniciar() {
  registrarPwa();
  $("#barra").replaceChildren(barraPac("Especialidades", "home.html"));
  montarNavPaciente("inicio");
  const raiz = $("#conteudo");
  raiz.replaceChildren(h("p", { class: "pac-vazio", role: "status" }, "Carregando especialidades..."));
  try {
    const cat = await carregarCatalogo();
    itens = cat.especialidades;
    const lista = h("div", { class: "pac-lista", role: "list" });
    raiz.replaceChildren(buscaPac("Buscar especialidade...", (t) => ((texto = t), desenharLista(lista))), h("p", { class: "pac-lista-titulo" }, "Especialidades ortopédicas"), lista);
    desenharLista(lista);
  } catch (err) {
    raiz.replaceChildren(avisoDeErro(err.message));
  }
}

const sessao = exigirLogin([PERFIS.PACIENTE]);
if (sessao) iniciar();
