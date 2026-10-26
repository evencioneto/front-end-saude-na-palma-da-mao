// Barra inferior do paciente no design novo (Início, Consultas, Avisos, Perfil), como no Figma.
// O ícone é usado como máscara: a cor vem do CSS (verde na aba atual, cinza nas demais).
import { h, toast } from "../core/dom.js";

const ITENS = [
  { chave: "inicio", href: "home.html", rotulo: "Início", icone: "icons/pac/nav-inicio.svg" },
  { chave: "consultas", href: "agendamentos.html", rotulo: "Consultas", icone: "icons/pac/nav-consultas.svg" },
  // Ainda não existe a tela de avisos do paciente: o item avisa em vez de levar a uma página inexistente.
  { chave: "avisos", href: null, rotulo: "Avisos", icone: "icons/pac/nav-avisos.svg" },
  { chave: "perfil", href: "perfil.html", rotulo: "Perfil", icone: "icons/pac/nav-perfil.svg" },
];

const texto = (n) => (n > 9 ? "9+" : String(n));

// ativa = chave do item atual. selos = { consultas: 2, avisos: 3 } (0 ou ausente = sem selo).
export function montarNavPaciente(ativa, selos = {}) {
  const nav = h(
    "nav",
    { class: "pac-nav", "aria-label": "Principal" },
    ITENS.map((i) => {
      const n = Number(selos[i.chave] ?? 0);
      const marca = h(
        "span",
        { class: "pac-nav__marca" },
        h("span", { class: "pac-nav__icone", style: `--icone:url("${new URL(i.icone, document.baseURI).href}")`, "aria-hidden": "true" }),
        h("span", { class: "pac-selo", "data-selo": i.chave, hidden: !(n > 0), "aria-hidden": "true" }, n > 0 ? texto(n) : ""),
      );
      const filhos = [marca, h("span", {}, i.rotulo)];
      return i.href
        ? h("a", { href: i.href, "aria-current": i.chave === ativa ? "page" : false }, filhos)
        : h("button", { type: "button", onclick: () => toast("Os avisos estarão disponíveis em breve.") }, filhos);
    }),
  );
  document.body.classList.add("com-nav-pac");
  document.body.append(nav);
  return nav;
}

// Atualiza o número de um selo depois que os dados chegam (0 esconde).
export function definirSelo(chave, n) {
  const selo = document.querySelector(`.pac-selo[data-selo="${chave}"]`);
  if (!selo) return;
  selo.hidden = !(n > 0);
  selo.textContent = n > 0 ? texto(n) : "";
  // O número é só visual (aria-hidden); o leitor de tela recebe o texto completo no nome do link.
  const link = selo.closest("a,button");
  const rotulo = link?.lastElementChild?.textContent ?? "";
  if (n > 0) link?.setAttribute("aria-label", `${rotulo}, ${n} ${chave === "avisos" ? "novos" : "em aberto"}`);
  else link?.removeAttribute("aria-label");
}
