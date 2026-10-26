// Clínicas (paciente): lista com busca. Cada cartão leva aos detalhes da clínica.
// O Figma mostra distância e horário de funcionamento, mas a API não tem esses dados: no lugar vão as especialidades.
import { exigirLogin, PERFIS } from "../core/guard.js";
import { h, $ } from "../core/dom.js";
import { avisoDeErro } from "../ui/layout.js";
import { barraPac, buscaPac, iconePac } from "../ui/fluxoPaciente.js";
import { montarNavPaciente } from "../ui/navPaciente.js";
import { normalizar } from "../ui/fluxo.js";
import { carregarCatalogo, nomesDasEspecialidades } from "../ui/catalogo.js";
import { registrarPwa } from "../pwa.js";

let cat;
let texto = "";

function cartao(c) {
  const ids = cat.clinEsp.filter((x) => x.idClinica === c.id).map((x) => x.idEspecialidade);
  const especialidades = nomesDasEspecialidades(cat, ids);
  return h(
    "a",
    { class: "pac-clinica", href: `clinica.html?id=${c.id}` },
    iconePac("cruz-clinica", 48),
    h(
      "span",
      { class: "pac-clinica__texto" },
      h("span", { class: "pac-clinica__nome" }, h("span", {}, c.nome), c.ativo ? null : h("span", { class: "pac-pilula pac-pilula--inativa" }, "Inativa")),
      h("span", { class: "pac-clinica__linha" }, iconePac("pin-cinza", 13), h("span", {}, [c.ruaNumero, c.cidadeUf].filter(Boolean).join(", ") || "Endereço não informado")),
      especialidades ? h("span", { class: "pac-clinica__linha pac-clinica__esp" }, h("span", {}, especialidades)) : null,
    ),
    h("span", { class: "pac-clinica__seta", "aria-hidden": "true" }, iconePac("chevron-menu")),
  );
}

function desenharLista(lista) {
  const alvo = normalizar(texto);
  const itens = cat.clinicas.filter((c) => !alvo || normalizar(`${c.nome} ${c.endereco}`).includes(alvo));
  lista.replaceChildren(...(itens.length ? itens.map(cartao) : [h("p", { class: "pac-vazio" }, "Nenhuma clínica encontrada.")]));
  lista.setAttribute("aria-label", `${itens.length} clínica${itens.length === 1 ? "" : "s"}`);
}

async function iniciar() {
  registrarPwa();
  $("#barra").replaceChildren(barraPac("Clínicas", "home.html"));
  montarNavPaciente("inicio");
  const raiz = $("#conteudo");
  raiz.replaceChildren(h("p", { class: "pac-vazio", role: "status" }, "Carregando clínicas..."));
  try {
    cat = await carregarCatalogo({ incluirInativos: true });
    const lista = h("div", { class: "pac-clin__lista", role: "list" });
    const busca = buscaPac("Buscar clínica...", (t) => ((texto = t), desenharLista(lista)));
    raiz.replaceChildren(busca, lista);
    desenharLista(lista);
  } catch (err) {
    raiz.replaceChildren(avisoDeErro(err.message));
  }
}

const sessao = exigirLogin([PERFIS.PACIENTE]);
if (sessao) iniciar();
