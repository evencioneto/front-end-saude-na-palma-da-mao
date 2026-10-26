// Detalhe da especialidade (paciente): descrição, profissionais e clínicas que a atendem e atalho para agendar.
// O Figma mostra a distância de cada clínica, mas a API não tem esse dado: no lugar vai o bairro/cidade.
import { exigirLogin, PERFIS } from "../core/guard.js";
import { h, $ } from "../core/dom.js";
import { avisoDeErro } from "../ui/layout.js";
import { barraPac, iconePac } from "../ui/fluxoPaciente.js";
import { carregarCatalogo } from "../ui/catalogo.js";
import { iconeEspecialidade } from "../ui/iconesEspecialidade.js";
import { avatarProfissional } from "../ui/avatarProfissional.js";
import { resumoProfissional } from "../ui/dadosProfissional.js";
import { registrarPwa } from "../pwa.js";

const secao = (titulo, itens) => (itens.length ? h("section", { class: "pac-esp-det__secao" }, h("h2", {}, titulo), h("div", { class: "pac-esp-det__itens" }, itens)) : null);

async function iniciar() {
  registrarPwa();
  const id = Number(new URLSearchParams(location.search).get("id"));
  $("#barra").replaceChildren(barraPac("Especialidade", "especialidades.html"));
  const raiz = $("#conteudo");
  raiz.replaceChildren(h("p", { class: "pac-vazio", role: "status" }, "Carregando especialidade..."));
  try {
    const cat = await carregarCatalogo();
    const e = cat.especialidadePorId.get(id);
    if (!e) {
      raiz.replaceChildren(h("p", { class: "pac-vazio" }, "Especialidade não encontrada."), h("a", { class: "pac-btn pac-esp-det__agendar", href: "especialidades.html" }, "Ver especialidades"));
      return;
    }
    $("#barra").replaceChildren(barraPac(e.nome, "especialidades.html"));
    document.title = `${e.nome} | TriaOrto+`;

    const profissionais = cat.profissionais
      .map((p) => ({ p, r: resumoProfissional(cat, p) }))
      .filter(({ r }) => r.disponivel && r.idsEsp.includes(id));
    const idsClinicas = new Set(cat.clinEsp.filter((x) => x.idEspecialidade === id).map((x) => x.idClinica));
    const clinicas = cat.clinicas.filter((c) => c.ativo && idsClinicas.has(c.id));

    raiz.replaceChildren(
      ...[
      h(
        "section",
        { class: "pac-esp-det__cartao", "aria-label": "Sobre a especialidade" },
        h("div", { class: "pac-esp-det__topo" }, h("span", { class: "pac-esp-det__icone" }, iconePac(iconeEspecialidade(e.nome), 32)), h("h1", { class: "pac-esp-det__nome" }, e.nome)),
        e.descricao ? h("p", { class: "pac-esp-det__desc" }, e.descricao) : null,
      ),
      secao(
        "Profissionais disponíveis",
        profissionais.map(({ p, r }) =>
          h("a", { class: "pac-mini", href: `profissional.html?id=${p.id}` }, avatarProfissional(p, "pac-ini--mini"), h("span", { class: "pac-mini__texto" }, h("span", { class: "pac-mini__nome" }, p.nome), h("span", { class: "pac-mini__sub" }, r.clinica?.nome ?? ""))),
        ),
      ),
      secao(
        "Clínicas disponíveis",
        clinicas.map((c) =>
          h("a", { class: "pac-mini", href: `clinica.html?id=${c.id}` }, iconePac("cruz-clinica", 36), h("span", { class: "pac-mini__texto" }, h("span", { class: "pac-mini__nome" }, c.nome), h("span", { class: "pac-mini__sub" }, [c.bairro, c.cidadeUf].filter(Boolean).join(", ") || c.ruaNumero))),
        ),
      ),
      !profissionais.length && !clinicas.length ? h("p", { class: "pac-vazio" }, "Nenhum profissional ou clínica disponível para esta especialidade no momento.") : null,
      profissionais.length
        ? h("a", { class: "pac-btn pac-esp-det__agendar", href: `agendamento.html?especialidade=${e.id}` }, "Agendar consulta")
        : h("button", { class: "pac-btn pac-esp-det__agendar", type: "button", disabled: true }, "Indisponível para agendar"),
      ].filter(Boolean),
    );
  } catch (err) {
    raiz.replaceChildren(avisoDeErro(err.message));
  }
}

const sessao = exigirLogin([PERFIS.PACIENTE]);
if (sessao) iniciar();
