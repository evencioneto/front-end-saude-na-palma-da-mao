// Carrega e prepara a agenda do profissional logado (junção feita no cliente, como no resto do app).
import { agendamentoService } from "../services/agendamentoService.js";
import { pacienteApi } from "../services/usuarioService.js";
import { toPaciente } from "../mappers/index.js";
import { carregarCatalogo } from "./catalogo.js";
import { salvarSelos } from "./profissional.js";
import { hojeISO } from "../core/datetime.js";

export const ABERTOS = ["PENDENTE", "CONFIRMADO"];

// Texto da justificativa guardado no campo "observacao" do agendamento.
const MARCA = "Justificativa:";
export const montarObservacao = (atual, justificativa) =>
  `${atual ? `${atual} | ` : ""}${MARCA} ${justificativa}`;
export const extrairJustificativa = (obs) => {
  const i = String(obs ?? "").lastIndexOf(MARCA);
  return i < 0 ? "" : obs.slice(i + MARCA.length).trim();
};

export async function carregarAgenda(sessao) {
  if (!sessao.idProfissional) return { cat: null, meus: [], semCadastro: true };

  const [lista, cat, pacientes] = await Promise.all([
    agendamentoService.listar(),
    carregarCatalogo({ incluirInativos: true }),
    pacienteApi.listar(),
  ]);
  const vinculos = new Set(cat.vinculos.filter((v) => v.idProfissional === sessao.idProfissional).map((v) => v.id));
  const pacientePorId = new Map(pacientes.map(toPaciente).map((p) => [p.id, p]));

  const meus = lista
    .filter((a) => vinculos.has(a.idVinculo))
    .map((a) => ({
      ...a,
      paciente: pacientePorId.get(a.idPaciente)?.usuario?.nome ?? "Paciente",
      especialidade: a.especialidadeNome || cat.especialidadePorId.get(a.idEspecialidade)?.nome || "Consulta",
      justificativa: extrairJustificativa(a.observacao),
    }));

  atualizarSelos(meus);
  return { cat, meus, semCadastro: false };
}

export const doDia = (meus, data = hojeISO()) =>
  meus.filter((a) => a.data === data).sort((a, b) => a.hora.localeCompare(b.hora));

// Selo da Agenda = consultas de hoje ainda abertas. Selo de Notificações = agendamentos aguardando confirmação.
export function atualizarSelos(meus) {
  salvarSelos({
    agenda: doDia(meus).filter((a) => ABERTOS.includes(a.status)).length,
    notificacoes: meus.filter((a) => a.status === "PENDENTE" && a.data >= hojeISO()).length,
  });
}
