// Perfil do profissional (paciente): dados, clínica vinculada e atalho para agendar.
import { exigirLogin, PERFIS } from "../core/guard.js";
import { h, $ } from "../core/dom.js";
import { avisoDeErro } from "../ui/layout.js";
import { barraPac, iconePac } from "../ui/fluxoPaciente.js";
import { carregarCatalogo } from "../ui/catalogo.js";
import { avatarProfissional } from "../ui/avatarProfissional.js";
import { resumoProfissional, registroProfissional } from "../ui/dadosProfissional.js";
import { formatarTelefone, apenasDigitos } from "../ui/mascaras.js";
import { registrarPwa } from "../pwa.js";

const linha = (icone, filho) => h("li", {}, iconePac(icone, 16), filho);

async function iniciar() {
  registrarPwa();
  const id = Number(new URLSearchParams(location.search).get("id"));
  $("#barra").replaceChildren(barraPac("Profissional", "profissionais.html"));
  const raiz = $("#conteudo");
  raiz.replaceChildren(h("p", { class: "pac-vazio", role: "status" }, "Carregando profissional..."));
  try {
    const cat = await carregarCatalogo({ incluirInativos: true });
    const p = cat.profissionalPorId.get(id);
    if (!p) {
      raiz.replaceChildren(h("p", { class: "pac-vazio" }, "Profissional não encontrado."), h("a", { class: "pac-btn pac-prof-det__agendar", href: "profissionais.html" }, "Ver profissionais"));
      return;
    }
    document.title = `${p.nome} | TriaOrto+`;
    const r = resumoProfissional(cat, p);
    const c = r.clinica;
    const tel = apenasDigitos(p.telefone);
    const registro = registroProfissional(p);

    // Atalho: leva à primeira especialidade e à clínica do profissional (o fluxo de agendamento escolhe o resto).
    const params = new URLSearchParams();
    if (r.idsEsp[0]) params.set("especialidade", r.idsEsp[0]);
    if (c?.ativo) params.set("clinica", c.id);
    const href = `agendamento.html${params.size ? `?${params}` : ""}`;

    raiz.replaceChildren(
      ...[
      h(
        "section",
        { class: "pac-prof-det__cartao", "aria-label": "Dados do profissional" },
        h(
          "div",
          { class: "pac-prof-det__topo" },
          avatarProfissional(p, "pac-ini--grande"),
          h(
            "div",
            {},
            h("h1", { class: "pac-prof-det__nome" }, p.nome),
            r.especialidades.length ? h("p", { class: "pac-prof-det__esp" }, r.especialidades.join(", ")) : null,
            registro ? h("p", { class: "pac-prof-det__registro" }, registro) : null,
          ),
        ),
        h(
          "ul",
          { class: "pac-prof-det__dados" },
          c ? linha("det-cruz", h("span", {}, c.nome)) : null,
          tel ? linha("det-tel", h("a", { href: `tel:${tel}` }, formatarTelefone(tel))) : null,
          p.email ? linha("det-mail", h("a", { href: `mailto:${p.email}` }, p.email)) : null,
        ),
        h("p", { class: "pac-status pac-status--det", "data-disponivel": String(r.disponivel) }, r.disponivel ? "Disponível para consultas" : "Indisponível no momento"),
      ),
      c
        ? h(
            "section",
            { class: "pac-prof-det__clinica", "aria-label": "Clínica vinculada" },
            h("h2", {}, "Clínica vinculada"),
            h("a", { class: "pac-prof-det__clinica-nome", href: `clinica.html?id=${c.id}` }, c.nome),
            [c.ruaNumero, c.cidadeUf].filter(Boolean).length ? h("p", { class: "pac-prof-det__end" }, iconePac("pin-cinza", 13), h("span", {}, [c.ruaNumero, c.cidadeUf].filter(Boolean).join(", "))) : null,
          )
        : null,
      r.disponivel
        ? h("a", { class: "pac-btn pac-prof-det__agendar", href }, "Agendar com este profissional")
        : h("button", { class: "pac-btn pac-prof-det__agendar", type: "button", disabled: true }, "Indisponível para agendar"),
      ].filter(Boolean),
    );
  } catch (err) {
    raiz.replaceChildren(avisoDeErro(err.message));
  }
}

const sessao = exigirLogin([PERFIS.PACIENTE]);
if (sessao) iniciar();
