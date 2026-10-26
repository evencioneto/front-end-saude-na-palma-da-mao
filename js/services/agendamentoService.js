import { crud, ApiError } from "../core/http.js";
import { toAgendamento } from "../mappers/index.js";
import { paraApi } from "../core/datetime.js";

const agendamentos = crud("/agendamentos");

export const agendamentoService = {
  // A API não filtra: traz todos. Filtre no cliente (por paciente, vínculo, data).
  async listar() {
    return (await agendamentos.listar()).map(toAgendamento);
  },

  // Cria um agendamento PENDENTE.
  // O back-end NÃO valida conflito de horário, então conferimos aqui, logo antes de gravar.
  // Isso reduz, mas não elimina, a chance de dois pacientes pegarem o mesmo horário.
  async criar({ idPaciente, idVinculo, idEspecialidade, data, hora, observacao }) {
    const existentes = await this.listar();
    const ocupado = existentes.some(
      (a) =>
        a.idVinculo === Number(idVinculo) &&
        a.data === data &&
        a.hora === hora &&
        a.status !== "CANCELADO",
    );
    if (ocupado) {
      throw new ApiError("Esse horário acabou de ser ocupado. Escolha outro.", 409);
    }

    return agendamentos.criar({
      id_paciente: Number(idPaciente),
      id_profissional_clinica: Number(idVinculo),
      id_especialidade: Number(idEspecialidade),
      data_hora: paraApi(data, hora),
      status: "PENDENTE",
      observacao: observacao || null,
    });
  },

  // Cancelar = mudar o status (mantém o histórico), não apagar o registro.
  async alterarStatus(id, status) {
    await agendamentos.atualizar(id, { status });
  },

  // Cancelamento pelo profissional: muda o status e grava a justificativa em "observacao".
  async cancelarComJustificativa(id, observacao) {
    await agendamentos.atualizar(id, { status: "CANCELADO", observacao });
  },
};

const EM_ABERTO = ["PENDENTE", "CONFIRMADO"];

// Quantas consultas futuras o paciente tem em aberto (selo da aba "Consultas" do Início).
export function contarConsultasEmAberto(agendamentos, idPaciente, hoje, agora) {
  return agendamentos.filter(
    (a) => a.idPaciente === idPaciente && EM_ABERTO.includes(a.status) && `${a.data} ${a.hora}` >= `${hoje} ${agora}`,
  ).length;
}
