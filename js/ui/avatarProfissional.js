// Círculo colorido com as iniciais do profissional (o Figma usa uma cor por pessoa).
import { h } from "../core/dom.js";

const CORES = ["#0f7a6d", "#7c3aed", "#b45309", "#db2777", "#0369a1"];

// "Dra. Ana Paula Ferreira" -> "AF"; ignora tratamentos (Dr., Dra.) e liga de nomes (de, da...).
export function iniciais(nome) {
  const partes = String(nome ?? "")
    .replace(/\b(dr|dra|prof|profa)\.?(?=\s)/gi, "")
    .split(/\s+/)
    .filter((p) => p && !/^(de|da|do|dos|das|e)$/i.test(p));
  if (!partes.length) return "?";
  const letras = partes.length === 1 ? partes[0].slice(0, 2) : partes[0][0] + partes[partes.length - 1][0];
  return letras.toUpperCase();
}

export function avatarProfissional(p, classe = "") {
  return h("span", { class: `pac-ini ${classe}`.trim(), style: `background:${CORES[Math.abs((Number(p.id) || 1) - 1) % CORES.length]}`, "aria-hidden": "true" }, iniciais(p.nome));
}
