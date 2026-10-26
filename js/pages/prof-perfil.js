// Perfil do profissional: dados do cadastro e botão Sair.
import { exigirLogin, PERFIS } from "../core/guard.js";
import { h, $ } from "../core/dom.js";
import { registrarPwa } from "../pwa.js";
import { authService } from "../services/authService.js";
import { carregarCatalogo } from "../ui/catalogo.js";
import { iniciais } from "../ui/fluxo.js";
import { barraProf, montarNavProf, icone } from "../ui/profissional.js";

async function iniciar(s) {
  registrarPwa();

  const esp = h("p", { class: "prof-perfil__esp" });
  const registro = h("p", { class: "prof-perfil__registro" });
  const telefone = h("span", {}, "—");
  const email = h("span", {}, s.email ?? "—");
  const clinica = h("span", {}, "—");
  const contato = (ic, no) => h("li", {}, icone(ic, 14), no);

  $("#conteudo").replaceChildren(
    barraProf("Perfil"),
    h(
      "div",
      { class: "prof-corpo" },
      h(
        "section",
        { class: "prof-cartao prof-perfil" },
        h(
          "div",
          { class: "prof-perfil__cabeca" },
          h("div", { class: "prof-avatar", "aria-hidden": "true" }, iniciais(s.nome)),
          h("div", {}, h("h2", { class: "prof-perfil__nome" }, s.nome ?? ""), esp, registro),
        ),
        h("ul", { class: "prof-perfil__contatos" }, contato("telefone", telefone), contato("email", email), contato("clinica", clinica)),
      ),
      h(
        "button",
        { class: "prof-sair", type: "button", onclick: () => authService.logout() },
        h("span", { class: "prof-sair__icone" }, icone("sair", 18)),
        h("span", { class: "prof-sair__texto" }, "Sair"),
      ),
    ),
  );
  montarNavProf("perfil");

  try {
    const cat = await carregarCatalogo({ incluirInativos: true });
    const p = cat.profissionalPorId.get(s.idProfissional);
    if (p) {
      telefone.textContent = p.telefone || "—";
      email.textContent = p.email || s.email || "—";
      registro.textContent = [p.conselho, [p.registro, p.uf].filter(Boolean).join("-")].filter(Boolean).join(" ");
    }
    const nomes = cat.profEsp
      .filter((x) => x.idProfissional === s.idProfissional)
      .map((x) => cat.especialidadePorId.get(x.idEspecialidade)?.nome)
      .filter(Boolean);
    esp.textContent = nomes.join(", ");
    const v = cat.vinculos.find((x) => x.idProfissional === s.idProfissional);
    clinica.textContent = (v && cat.clinicaPorId.get(v.idClinica)?.nome) || "—";
  } catch {
    /* sem rede: mantém os dados da sessão */
  }
}

const sessao = exigirLogin([PERFIS.PROFISSIONAL]);
if (sessao) iniciar(sessao);
