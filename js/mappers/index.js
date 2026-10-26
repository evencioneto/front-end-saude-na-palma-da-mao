// Normaliza os dados da API (snake_case, IDs em string) para o formato usado no front.
// Importante: o campo senha_hash NUNCA é copiado para os objetos do front.
import { lerDataHora } from "../core/datetime.js";

const num = (v) => (v === null || v === undefined ? null : Number(v));
const hhmm = (t) => (t ? String(t).slice(0, 5) : "");

export const toClinica = (c) => ({
  id: num(c.id_clinica),
  nome: c.nome,
  cnpj: c.cnpj,
  bairro: c.bairro ?? "",
  telefone: c.telefone ?? "",
  email: c.email ?? "",
  endereco: [
    [c.logradouro, c.numero].filter(Boolean).join(", "),
    c.bairro,
    [c.cidade, c.uf].filter(Boolean).join("/"),
  ]
    .filter(Boolean)
    .join(" - "),
  // Partes do endereço, para cartões que mostram uma linha por informação.
  ruaNumero: [c.logradouro, c.numero].filter(Boolean).join(", "),
  cidadeUf: [c.cidade, c.uf].filter(Boolean).join("/"),
  ativo: c.ativo !== false,
});

export const toEspecialidade = (e) => ({
  id: num(e.id_especialidade),
  nome: e.nome,
  descricao: e.descricao ?? "",
  ativo: e.ativo !== false,
});

export const toUsuario = (u) => ({
  id: num(u.id_usuario),
  nome: u.nome,
  email: u.email,
  telefone: u.telefone ?? "",
  tipo: u.tipo_usuario,
  ativo: u.ativo !== false,
});

export const toPaciente = (p) => ({
  id: num(p.id_paciente),
  idUsuario: num(p.id_usuario),
  cpf: p.cpf,
  nascimento: p.data_nascimento,
  sexo: p.sexo ?? "",
  criadoEm: p.usuario?.criado_em ?? null,
  usuario: p.usuario ? toUsuario(p.usuario) : null,
});

export const toProfissional = (p) => ({
  id: num(p.id_profissional),
  idUsuario: num(p.id_usuario),
  cpf: p.cpf,
  conselho: p.conselho,
  registro: p.registro_profissional,
  uf: p.uf_registro,
  ativo: p.ativo !== false,
  nome: p.usuario?.nome ?? `Profissional ${p.id_profissional}`,
  email: p.usuario?.email ?? "",
  telefone: p.usuario?.telefone ?? "",
  criadoEm: p.usuario?.criado_em ?? null,
});

export const toVinculo = (v) => ({
  id: num(v.id_profissional_clinica),
  idProfissional: num(v.id_profissional),
  idClinica: num(v.id_clinica),
  ativo: v.ativo !== false,
});

export const toDisponibilidade = (d) => ({
  id: num(d.id_disponibilidade),
  idVinculo: num(d.id_profissional_clinica),
  data: d.data_atendimento,
  horaInicio: hhmm(d.hora_inicio),
  horaFim: hhmm(d.hora_fim),
  duracaoMinutos: Number(d.duracao_minutos),
  status: d.status,
});

export const toAgendamento = (a) => {
  const { data, hora } = lerDataHora(a.data_hora);
  return {
    id: num(a.id_agendamento),
    idPaciente: num(a.id_paciente),
    idVinculo: num(a.id_profissional_clinica),
    idEspecialidade: num(a.id_especialidade),
    data,
    hora,
    status: a.status,
    observacao: a.observacao ?? "",
    especialidadeNome: a.especialidade?.nome ?? "",
  };
};

export const STATUS_AGENDAMENTO = {
  PENDENTE: "Pendente",
  CONFIRMADO: "Confirmado",
  CANCELADO: "Cancelado",
  CONCLUIDO: "Concluído",
};
