import { h } from "../core/dom.js";
import { authService } from "../services/authService.js";
import { PERFIS, paginaInicial } from "../core/guard.js";
import { montarNavInferior } from "./navInferior.js";
import { registrarPwa } from "../pwa.js";

const MENU = {
  // Paciente navega pela barra inferior (ui/navInferior.js), como no Figma.
  [PERFIS.PROFISSIONAL]: [
    ["disponibilidades.html", "Meus horários"],
    ["prof-agenda.html", "Minha agenda"],
  ],
  [PERFIS.ADMIN]: [
    ["adm-clinicas.html", "Clínicas"],
    ["profissionais.html", "Profissionais"],
    ["disponibilidades.html", "Horários"],
    ["adm-agendamentos.html", "Agendamentos"],
  ],
};

const ROTULO_PERFIL = {
  PACIENTE: "Paciente",
  PROFISSIONAL: "Profissional",
  ADMINISTRADOR: "Administrador",
};

// Desenha o cabeçalho (#topo) e o aviso de servidor lento.
export function montarLayout(s) {
  registrarPwa();
  const pagina = location.pathname.split("/").pop() || "index.html";

  const banner = h(
    "div",
    { class: "banner-lenta", role: "status", hidden: true },
    "Acordando o servidor. A primeira consulta pode levar até 1 minuto, aguarde...",
  );
  window.addEventListener("api:lenta", () => (banner.hidden = false));
  window.addEventListener("api:ociosa", () => (banner.hidden = true));

  const links = (MENU[s.tipo] ?? []).map(([href, texto]) =>
    h("a", { href, "aria-current": href === pagina ? "page" : false }, texto),
  );

  const topo = document.getElementById("topo");
  topo.className = "topo";
  const partes = [
    h(
      "div",
      { class: "topo__barra" },
      h(
        "a",
        { class: "topo__marca", href: paginaInicial(s.tipo), "aria-label": "TriaOrto+, ir para o início" },
        h("img", { src: "icons/logo.svg", alt: "", width: "30", height: "30" }),
        h("span", {}, "TriaOrto", h("span", {}, "+")),
      ),
      h(
        "div",
        {},
        h("span", { class: "topo__usuario" }, `${s.nome} (${ROTULO_PERFIL[s.tipo] ?? s.tipo})  `),
        h("button", { class: "btn btn--secundario btn--pequeno", type: "button", onclick: () => authService.logout() }, "Sair"),
      ),
    ),
    links.length ? h("nav", { class: "nav", "aria-label": "Principal" }, links) : null,
    banner,
  ];
  topo.replaceChildren(...partes.filter(Boolean)); // replaceChildren(null) viraria o texto "null"

  if (s.tipo === PERFIS.PACIENTE) montarNavInferior("agendamentos");
}

export function avisoDeErro(mensagem) {
  return h("div", { class: "alerta alerta--erro", role: "alert" }, mensagem);
}
