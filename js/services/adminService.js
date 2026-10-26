// Indicadores da tela inicial do administrador.
// A API não tem endpoint de relatório: os números são calculados aqui, no navegador,
// a partir das listas que ela já entrega (clínicas, profissionais, pacientes, agendamentos...).
import { crud } from "../core/http.js";
import { toPaciente } from "../mappers/index.js";
import { clinicaService } from "./clinicaService.js";
import { especialidadeService } from "./especialidadeService.js";
import { profissionalService } from "./profissionalService.js";
import { agendamentoService } from "./agendamentoService.js";
import { disponibilidadeService } from "./disponibilidadeService.js";

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const maiuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);

// ---- Períodos do relatório ----
// "mensal": um mês inteiro. "semanal": de segunda a domingo.
export function periodos(tipo, hoje = new Date()) {
  const lista = [];
  if (tipo === "semanal") {
    const seg = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    seg.setDate(seg.getDate() - ((seg.getDay() + 6) % 7)); // volta até a segunda-feira
    for (let i = 0; i < 12; i++) {
      const ini = new Date(seg);
      ini.setDate(seg.getDate() - 7 * i);
      const fim = new Date(ini);
      fim.setDate(ini.getDate() + 6);
      lista.push(montar(ini, fim, rotuloSemana(ini, fim)));
    }
  } else {
    for (let i = 0; i < 12; i++) {
      const ini = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const fim = new Date(ini.getFullYear(), ini.getMonth() + 1, 0);
      lista.push(montar(ini, fim, `${maiuscula(MESES[ini.getMonth()])} de ${ini.getFullYear()}`));
    }
  }
  return lista;
}

function montar(ini, fim, rotulo) {
  return { inicio: iso(ini), fim: iso(fim), rotulo, descricao: descricaoPeriodo(ini, fim) };
}

function rotuloSemana(ini, fim) {
  const a = `${pad(ini.getDate())}/${pad(ini.getMonth() + 1)}`;
  const b = `${pad(fim.getDate())}/${pad(fim.getMonth() + 1)}/${fim.getFullYear()}`;
  return `${a} a ${b}`;
}

// "01 a 30 de setembro de 2026" ou "28 de setembro a 04 de outubro de 2026"
export function descricaoPeriodo(ini, fim) {
  if (ini.getMonth() === fim.getMonth() && ini.getFullYear() === fim.getFullYear()) {
    return `${pad(ini.getDate())} a ${pad(fim.getDate())} de ${MESES[fim.getMonth()]} de ${fim.getFullYear()}`;
  }
  return `${pad(ini.getDate())} de ${MESES[ini.getMonth()]} a ${pad(fim.getDate())} de ${MESES[fim.getMonth()]} de ${fim.getFullYear()}`;
}

// ---- Cálculo (função pura, testável sem rede) ----
const FAIXAS = [
  ["0–17", 0, 17],
  ["18–29", 18, 29],
  ["30–49", 30, 49],
  ["50–69", 50, 69],
  ["70+", 70, 200],
];

const idade = (nascimento, hojeIso) => {
  if (!nascimento) return null;
  const [a, m, d] = String(nascimento).slice(0, 10).split("-").map(Number);
  const [ha, hm, hd] = hojeIso.split("-").map(Number);
  let anos = ha - a;
  if (hm < m || (hm === m && hd < d)) anos--;
  return anos >= 0 ? anos : null;
};

const pct = (parte, todo) => (todo > 0 ? Math.round((parte / todo) * 100) : null);
const emMin = (t) => {
  const [h, m] = String(t).split(":").map(Number);
  return h * 60 + m;
};
const dentro = (data, p) => !!data && data >= p.inicio && data <= p.fim;
const topN = (mapa, n) => [...mapa.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, n);

export function calcularIndicadores(d, periodo, hojeIso) {
  const ativas = d.clinicas.filter((c) => c.ativo);
  const espAtivas = d.especialidades.filter((e) => e.ativo);
  const profAtivos = d.profissionais.filter((p) => p.ativo);
  const nomeEsp = new Map(d.especialidades.map((e) => [e.id, e.nome]));
  const nomeClin = new Map(d.clinicas.map((c) => [c.id, c.nome]));
  const clinicaDoVinculo = new Map(d.vinculos.map((v) => [v.id, v.idClinica]));

  // Topo
  const doDia = d.agendamentos.filter((a) => a.data === hojeIso);
  const topo = {
    clinicas: ativas.length,
    profissionais: profAtivos.length,
    especialidades: espAtivas.length,
    pacientes: d.pacientes.length,
    agendamentosHoje: doDia.filter((a) => a.status !== "CANCELADO").length,
    cancelamentos: doDia.filter((a) => a.status === "CANCELADO").length,
  };

  // Período
  const ag = d.agendamentos.filter((a) => dentro(a.data, periodo));
  const total = ag.length;
  const concluidos = ag.filter((a) => a.status === "CONCLUIDO").length;
  const cancelados = ag.filter((a) => a.status === "CANCELADO").length;
  const pendentes = ag.filter((a) => a.status === "PENDENTE" || a.status === "CONFIRMADO").length;

  const novos = d.pacientes.filter((p) => dentro(String(p.criadoEm ?? "").slice(0, 10), periodo)).length;
  const antes = d.pacientes.filter((p) => !p.criadoEm || String(p.criadoEm).slice(0, 10) < periodo.inicio).length;

  const vagas = d.disponibilidades
    .filter((x) => dentro(x.data, periodo))
    .reduce((s, x) => s + (x.duracaoMinutos > 0 ? Math.floor((emMin(x.horaFim) - emMin(x.horaInicio)) / x.duracaoMinutos) : 0), 0);
  const ocupados = total - cancelados;

  const porEsp = new Map();
  const porClinica = new Map();
  for (const a of ag) {
    porEsp.set(a.idEspecialidade, (porEsp.get(a.idEspecialidade) ?? 0) + 1);
    const c = clinicaDoVinculo.get(a.idVinculo);
    if (c) porClinica.set(c, (porClinica.get(c) ?? 0) + 1);
  }

  // Médicos: "indisponível" = ativo, mas sem nenhum horário livre de hoje em diante.
  const comHorario = new Set();
  const vinculoProf = new Map(d.vinculos.map((v) => [v.id, v.idProfissional]));
  for (const x of d.disponibilidades) {
    if (x.status === "DISPONIVEL" && x.data >= hojeIso) comHorario.add(vinculoProf.get(x.idVinculo));
  }
  const medicos = {
    ativos: profAtivos.filter((p) => comHorario.has(p.id)).length,
    inativos: d.profissionais.length - profAtivos.length,
    indisponiveis: profAtivos.filter((p) => !comHorario.has(p.id)).length,
  };

  // Pacientes
  const faixas = FAIXAS.map(([rotulo, min, max]) => ({
    rotulo,
    n: d.pacientes.filter((p) => {
      const i = idade(p.nascimento, hojeIso);
      return i !== null && i >= min && i <= max;
    }).length,
  }));
  const comIdade = faixas.reduce((s, f) => s + f.n, 0);
  const faixaTop = faixas.reduce((a, b) => (b.n > a.n ? b : a), { n: 0 });
  const mulheres = d.pacientes.filter((p) => p.sexo === "F").length;
  const homens = d.pacientes.filter((p) => p.sexo === "M").length;
  const porPaciente = new Map();
  for (const a of d.agendamentos) porPaciente.set(a.idPaciente, (porPaciente.get(a.idPaciente) ?? 0) + 1);
  const retornaram = [...porPaciente.values()].filter((n) => n >= 2).length;

  // Especialidades cadastradas e quantos médicos ativos atendem cada uma
  const ativoPorId = new Set(profAtivos.map((p) => p.id));
  const especialidades = espAtivas.map((e) => ({
    nome: e.nome,
    medicos: new Set(d.profEsp.filter((x) => x.idEspecialidade === e.id && ativoPorId.has(x.idProfissional)).map((x) => x.idProfissional)).size,
  }));

  // Log: cadastros novos de pacientes e médicos no período (clínicas e especialidades não têm data de criação)
  const log = [
    ...d.pacientes.map((p) => ({ quando: String(p.criadoEm ?? "").slice(0, 10), rotulo: "Novo paciente", nome: p.usuario?.nome ?? "" })),
    ...d.profissionais.map((p) => ({ quando: String(p.criadoEm ?? "").slice(0, 10), rotulo: "Novo médico", nome: p.nome })),
  ]
    .filter((x) => dentro(x.quando, periodo) && x.nome)
    .sort((a, b) => b.quando.localeCompare(a.quando))
    .slice(0, 5)
    .map((x) => ({ data: `${x.quando.slice(8, 10)}/${x.quando.slice(5, 7)}`, rotulo: x.rotulo, nome: x.nome }));

  return {
    topo,
    periodo: {
      total,
      concluidos,
      cancelados,
      pendentes,
      taxaConclusao: pct(concluidos, total),
      taxaCancelamento: pct(cancelados, total),
      novosPacientes: novos,
      crescimento: pct(novos, antes),
      ocupacao: vagas > 0 ? Math.min(100, pct(ocupados, vagas)) : null,
      topEspecialidades: topN(porEsp, 3).map(([id, n]) => ({ nome: nomeEsp.get(id) ?? "Especialidade", n })),
      topClinicas: topN(porClinica, 3).map(([id, n]) => ({ nome: nomeClin.get(id) ?? "Clínica", n })),
    },
    medicos,
    pacientes: {
      faixa: faixaTop.n > 0 ? `${faixaTop.rotulo} anos (${pct(faixaTop.n, comIdade)}%)` : null,
      demografia: mulheres + homens > 0 ? `${pct(mulheres, mulheres + homens)}% mulheres · ${pct(homens, mulheres + homens)}% homens` : null,
      retorno: porPaciente.size > 0 ? `${pct(retornaram, porPaciente.size)}% dos pacientes` : null,
    },
    especialidades,
    log,
  };
}

// ---- Telas "Agendamentos hoje" e "Cancelamentos" ----
// Funções puras (recebem as listas já carregadas). `hoje` = "YYYY-MM-DD"; `agora` = "HH:MM".
const EM_ABERTO = ["PENDENTE", "CONFIRMADO"];

// Resumo do dia (cancelados ficam de fora) e lista dos próximos atendimentos em aberto, do mais cedo ao mais tarde.
export function resumoAgendamentos(agendamentos, hoje, agora) {
  const doDia = agendamentos.filter((a) => a.data === hoje && a.status !== "CANCELADO");
  const proximos = agendamentos
    .filter((a) => EM_ABERTO.includes(a.status) && (a.data > hoje || (a.data === hoje && a.hora >= agora)))
    .sort((a, b) => `${a.data}${a.hora}`.localeCompare(`${b.data}${b.hora}`));
  return {
    total: doDia.length,
    concluidos: doDia.filter((a) => a.status === "CONCLUIDO").length,
    pendentes: doDia.filter((a) => EM_ABERTO.includes(a.status)).length,
    proximos,
  };
}

// Histórico de cancelamentos (mais recentes primeiro) e quantos caem no mês de `hoje`.
export function resumoCancelamentos(agendamentos, hoje) {
  const itens = agendamentos
    .filter((a) => a.status === "CANCELADO")
    .sort((a, b) => `${b.data}${b.hora}`.localeCompare(`${a.data}${a.hora}`));
  return { total: itens.length, esteMes: itens.filter((a) => a.data.slice(0, 7) === hoje.slice(0, 7)).length, itens };
}

// "2026-09-25" -> "25 de setembro de 2026"
export function dataPorExtenso(isoData) {
  const [y, m, d] = isoData.split("-").map(Number);
  return `${d} de ${MESES[m - 1]} de ${y}`;
}

// ---- Carga ----
export async function carregarDadosAdmin() {
  const [clinicas, especialidades, profissionais, vinculos, profEsp, pacientes, agendamentos, disponibilidades] = await Promise.all([
    clinicaService.listar({ apenasAtivas: false }),
    especialidadeService.listar({ apenasAtivas: false }),
    profissionalService.listar(),
    profissionalService.listarVinculos({ apenasAtivos: false }),
    profissionalService.listarEspecialidades(),
    crud("/pacientes").listar().then((l) => l.map(toPaciente)),
    agendamentoService.listar(),
    disponibilidadeService.listar(),
  ]);
  return { clinicas, especialidades, profissionais, vinculos, profEsp, pacientes, agendamentos, disponibilidades };
}

// Exportação do relatório (botão "Baixar relatório"): CSV com todos os indicadores da tela.
export function relatorioCsv(ind, periodo) {
  const linhas = [
    ["Relatório de desempenho", periodo.descricao],
    [],
    ["Indicador", "Valor"],
    ["Clínicas cadastradas", ind.topo.clinicas],
    ["Profissionais", ind.topo.profissionais],
    ["Especialidades", ind.topo.especialidades],
    ["Pacientes", ind.topo.pacientes],
    ["Agendamentos hoje", ind.topo.agendamentosHoje],
    ["Cancelamentos hoje", ind.topo.cancelamentos],
    ["Volume total de agendamentos no período", ind.periodo.total],
    ["Concluídos", ind.periodo.concluidos],
    ["Pendentes", ind.periodo.pendentes],
    ["Cancelados", ind.periodo.cancelados],
    ["Taxa de conclusão (%)", ind.periodo.taxaConclusao ?? ""],
    ["Taxa de cancelamento (%)", ind.periodo.taxaCancelamento ?? ""],
    ["Novos pacientes no período", ind.periodo.novosPacientes],
    ["Crescimento da base (%)", ind.periodo.crescimento ?? ""],
    ["Ocupação da agenda (%)", ind.periodo.ocupacao ?? ""],
    ["Médicos ativos", ind.medicos.ativos],
    ["Médicos inativos", ind.medicos.inativos],
    ["Médicos indisponíveis", ind.medicos.indisponiveis],
    [],
    ["Especialidades mais buscadas", "Agendamentos"],
    ...ind.periodo.topEspecialidades.map((x) => [x.nome, x.n]),
    [],
    ["Clínicas mais ativas", "Agendamentos"],
    ...ind.periodo.topClinicas.map((x) => [x.nome, x.n]),
    [],
    ["Especialidades cadastradas", "Médicos"],
    ...ind.especialidades.map((x) => [x.nome, x.medicos]),
  ];
  // Aspas duplas escapadas; "=", "+", "-" e "@" no início ganham apóstrofo (evita fórmula ao abrir no Excel).
  const celula = (v) => {
    let t = String(v ?? "");
    if (/^[=+\-@]/.test(t)) t = `'${t}`;
    return `"${t.replace(/"/g, '""')}"`;
  };
  return "﻿" + linhas.map((l) => l.map(celula).join(";")).join("\r\n");
}
