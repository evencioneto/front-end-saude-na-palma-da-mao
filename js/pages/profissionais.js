// Profissionais (paciente): lista com busca por nome, especialidade ou clínica. Cada cartão leva ao perfil do profissional.
import { exigirLogin, PERFIS } from "../core/guard.js";
import { h, $ } from "../core/dom.js";
import { avisoDeErro } from "../ui/layout.js";
import { barraPac, buscaPac, iconePac } from "../ui/fluxoPaciente.js";
import { montarNavPaciente } from "../ui/navPaciente.js";
import { normalizar } from "../ui/fluxo.js";
import { carregarCatalogo } from "../ui/catalogo.js";
import { avatarProfissional } from "../ui/avatarProfissional.js";
import { resumoProfissional } from "../ui/dadosProfissional.js";
import { registrarPwa } from "../pwa.js";

let itens = [];
let texto = "";

const cartao = ({ p, r }) =>
  h(
    "a",
    { class: "pac-pl", href: `profissional.html?id=${p.id}` },
    avatarProfissional(p),
    h(
      "span",
      { class: "pac-pl__texto" },
      h("span", { class: "pac-pl__nome" }, p.nome),
      r.especialidades.length ? h("span", { class: "pac-pl__esp" }, r.especialidades.join(", ")) : null,
      h("span", { class: "pac-pl__clinica" }, r.clinica?.nome ?? "Sem clínica vinculada"),
      h("span", { class: "pac-status", "data-disponivel": String(r.disponivel) }, r.disponivel ? "Disponível" : "Indisponível"),
    ),
    h("span", { class: "pac-pl__seta", "aria-hidden": "true" }, iconePac("chevron-menu")),
  );

function desenharLista(lista) {
  const alvo = normalizar(texto);
  const visiveis = itens.filter((i) => !alvo || normalizar(`${i.p.nome} ${i.r.especialidades.join(" ")} ${i.r.clinica?.nome ?? ""}`).includes(alvo));
  lista.replaceChildren(...(visiveis.length ? visiveis.map(cartao) : [h("p", { class: "pac-vazio" }, "Nenhum profissional encontrado.")]));
  lista.setAttribute("aria-label", `${visiveis.length} profissiona${visiveis.length === 1 ? "l" : "is"}`);
}

async function iniciar() {
  registrarPwa();
  $("#barra").replaceChildren(barraPac("Profissionais", "home.html"));
  montarNavPaciente("inicio");
  const raiz = $("#conteudo");
  raiz.replaceChildren(h("p", { class: "pac-vazio", role: "status" }, "Carregando profissionais..."));
  try {
    const cat = await carregarCatalogo({ incluirInativos: true });
    itens = cat.profissionais.map((p) => ({ p, r: resumoProfissional(cat, p) }));
    const lista = h("div", { class: "pac-pl__lista", role: "list" });
    // O Figma diz "Buscar por nome, especialidade ou clínica...", mas o texto não cabe numa linha do campo.
    raiz.replaceChildren(buscaPac("Buscar profissional...", (t) => ((texto = t), desenharLista(lista))), lista);
    desenharLista(lista);
  } catch (err) {
    raiz.replaceChildren(avisoDeErro(err.message));
  }
}

const sessao = exigirLogin([PERFIS.PACIENTE]);
if (sessao) iniciar();
