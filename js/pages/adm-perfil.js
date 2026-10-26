// "Meu perfil" do administrador: dados da sessão, atalhos de gestão, informações do sistema e Sair.
import { exigirLogin, PERFIS } from "../core/guard.js";
import { h, $ } from "../core/dom.js";
import { registrarPwa } from "../pwa.js";
import { authService } from "../services/authService.js";
import { formatarDataCurta } from "../core/datetime.js";
import { iniciaisNome, montarNavAdm, icone } from "../ui/admin.js";

// Atualize a cada publicação (acompanha o CACHE_VERSION do sw.js).
const VERSAO_SISTEMA = "1.0.0";
const ULTIMA_ATUALIZACAO = "2026-10-26";

const GESTAO = [
  { icone: "perfil-clinicas", rotulo: "Clínicas", href: "adm-clinicas.html" },
  { icone: "perfil-profissionais", rotulo: "Profissionais", href: "adm-profissionais.html" },
  { icone: "perfil-especialidades", rotulo: "Especialidades", href: "adm-especialidades.html" },
  { icone: "perfil-pacientes", rotulo: "Pacientes", href: "adm-pacientes.html" },
];

function iniciar(s) {
  registrarPwa();
  const linhaInfo = (rotulo, valor) => h("li", {}, h("span", {}, rotulo), h("span", { class: "adm-info__valor" }, valor));
  $("#conteudo").replaceChildren(
    h(
      "main",
      { class: "adm-home" },
      h("h1", { class: "adm-home__titulo" }, "Meu perfil"),
      h("p", { class: "adm-home__sub" }, "Administrador do sistema"),
      h(
        "section",
        { class: "adm-perfil" },
        h("div", { class: "adm-perfil__cabeca" }, [
          h("div", { class: "adm-avatar", "aria-hidden": "true" }, iniciaisNome(s.nome)),
          h("div", { class: "adm-perfil__dados" }, h("h2", { class: "adm-perfil__nome" }, s.nome ?? ""), h("p", { class: "adm-perfil__email" }, s.email ?? ""), h("p", { class: "adm-perfil__papel" }, "Administrador")),
        ]),
      ),
      h("h2", { class: "adm-rotulo-secao" }, "Gestão"),
      h(
        "ul",
        { class: "adm-menu" },
        GESTAO.map((g) =>
          h("li", {}, h("a", { href: g.href }, h("span", { class: "adm-menu__icone" }, icone(g.icone)), h("span", { class: "adm-menu__rotulo" }, g.rotulo), icone("seta-direita"))),
        ),
      ),
      h("h2", { class: "adm-rotulo-secao" }, "Sistema"),
      h("ul", { class: "adm-info" }, linhaInfo("Versão do sistema", VERSAO_SISTEMA), linhaInfo("Última atualização", formatarDataCurta(ULTIMA_ATUALIZACAO))),
      h("button", { class: "adm-sair", type: "button", onclick: () => authService.logout() }, h("span", { class: "adm-sair__icone" }, icone("sair")), h("span", { class: "adm-sair__rotulo" }, "Sair")),
    ),
  );
  montarNavAdm("perfil");
}

const sessao = exigirLogin([PERFIS.ADMIN]);
if (sessao) iniciar(sessao);
