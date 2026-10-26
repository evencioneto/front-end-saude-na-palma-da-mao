// Detalhes de uma clínica (paciente): endereço, contato, especialidades e atalho para agendar.
// Horário de funcionamento aparece no Figma, mas a API não tem esse dado.
import { exigirLogin, PERFIS } from "../core/guard.js";
import { h, $ } from "../core/dom.js";
import { avisoDeErro } from "../ui/layout.js";
import { barraPac, iconePac } from "../ui/fluxoPaciente.js";
import { carregarCatalogo } from "../ui/catalogo.js";
import { formatarTelefone, apenasDigitos } from "../ui/mascaras.js";
import { registrarPwa } from "../pwa.js";

const linha = (icone, filho) => h("li", {}, iconePac(icone, 16), filho);

async function iniciar() {
  registrarPwa();
  const id = Number(new URLSearchParams(location.search).get("id"));
  $("#barra").replaceChildren(barraPac("Clínica", "clinicas.html"));
  const raiz = $("#conteudo");
  raiz.replaceChildren(h("p", { class: "pac-vazio", role: "status" }, "Carregando clínica..."));
  try {
    const cat = await carregarCatalogo({ incluirInativos: true });
    const c = cat.clinicaPorId.get(id);
    if (!c) {
      raiz.replaceChildren(h("p", { class: "pac-vazio" }, "Clínica não encontrada."), h("a", { class: "pac-btn pac-clin-det__voltar", href: "clinicas.html" }, "Ver clínicas"));
      return;
    }
    $("#barra").replaceChildren(barraPac(c.nome, "clinicas.html"));
    document.title = `${c.nome} | TriaOrto+`;
    const esps = cat.clinEsp.filter((x) => x.idClinica === c.id).map((x) => cat.especialidadePorId.get(x.idEspecialidade)?.nome).filter(Boolean);
    const tel = apenasDigitos(c.telefone);
    const endereco = [c.ruaNumero, c.cidadeUf].filter(Boolean).join(", ");

    raiz.replaceChildren(
      ...[
      h(
        "section",
        { class: "pac-clin-det__cartao", "aria-label": "Dados da clínica" },
        h(
          "div",
          { class: "pac-clin-det__topo" },
          iconePac("cruz-clinica-g", 56),
          h("div", {}, h("h1", { class: "pac-clin-det__nome" }, c.nome), c.ativo ? null : h("span", { class: "pac-pilula pac-pilula--inativa" }, "Inativa")),
        ),
        h(
          "ul",
          { class: "pac-clin-det__dados" },
          endereco ? linha("det-pin", h("span", {}, endereco)) : null,
          tel ? linha("det-tel", h("a", { href: `tel:${tel}` }, formatarTelefone(tel))) : null,
          c.email ? linha("det-mail", h("a", { href: `mailto:${c.email}` }, c.email)) : null,
        ),
      ),
      esps.length
        ? h("section", { class: "pac-clin-det__esps" }, h("h2", {}, "Especialidades"), h("ul", {}, esps.map((n) => h("li", {}, n))))
        : null,
      c.ativo
        ? h("a", { class: "pac-btn pac-clin-det__agendar", href: `agendamento.html?clinica=${c.id}` }, "Agendar nesta clínica")
        : h("button", { class: "pac-btn pac-clin-det__agendar", type: "button", disabled: true }, "Indisponível para agendar"),
      ].filter(Boolean),
    );
  } catch (err) {
    raiz.replaceChildren(avisoDeErro(err.message));
  }
}

const sessao = exigirLogin([PERFIS.PACIENTE]);
if (sessao) iniciar();
