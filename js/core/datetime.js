import { DATAHORA_OFFSET_MIN } from "../config.js";

const pad = (n) => String(n).padStart(2, "0");

// "2026-10-25T11:00:00.000Z" -> { data: "2026-10-25", hora: "11:00" }
// Usa os componentes UTC como horário de parede (ver config.js).
export function lerDataHora(iso) {
  const texto = /Z$|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`;
  const d = new Date(new Date(texto).getTime() + DATAHORA_OFFSET_MIN * 60000);
  return {
    data: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    hora: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
  };
}

// ("2026-10-25", "08:30") -> "2026-10-25T08:30:00"  (formato enviado à API)
export const paraApi = (data, hora) => `${data}T${hora}:00`;

export function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function agoraHHMM() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// "2026-10-25" -> "domingo, 25 de outubro"
export function formatarData(data) {
  const [y, m, d] = data.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

// "2026-09-15" -> "15 de setembro de 2026 (terça-feira)"
export function formatarDataLonga(data) {
  const [y, m, d] = data.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const mes = dt.toLocaleDateString("pt-BR", { month: "long" });
  const dia = dt.toLocaleDateString("pt-BR", { weekday: "long" });
  return `${d} de ${mes} de ${y} (${dia})`;
}

export function formatarDataCurta(data) {
  const [y, m, d] = data.split("-");
  return `${d}/${m}/${y}`;
}

// Gera os horários de uma janela de disponibilidade.
// { horaInicio: "08:00", horaFim: "12:00", duracaoMinutos: 30 } -> ["08:00","08:30",...,"11:30"]
export function gerarHorarios({ horaInicio, horaFim, duracaoMinutos }) {
  const emMin = (t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const fmt = (n) => `${pad(Math.floor(n / 60))}:${pad(n % 60)}`;
  const passo = Number(duracaoMinutos);
  if (!(passo > 0)) return [];
  const saida = [];
  for (let t = emMin(horaInicio); t + passo <= emMin(horaFim); t += passo) saida.push(fmt(t));
  return saida;
}

// "2026-09-05" -> "05/09/2026" (sem passar por Date, para não sofrer com fuso horário).
export function dataCurta(iso) {
  const [y, m, d] = String(iso ?? "").split("-");
  return y && m && d ? `${d}/${m}/${y}` : "";
}
