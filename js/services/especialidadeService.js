import { crud } from "../core/http.js";
import { toEspecialidade } from "../mappers/index.js";

const especialidades = crud("/especialidades");
const clinicaEspecialidades = crud("/clinica-especialidade");
const profEspecialidades = crud("/profissional-especialidade");

export const especialidadeService = {
  async listar({ apenasAtivas = true } = {}) {
    const lista = (await especialidades.listar()).map(toEspecialidade);
    return apenasAtivas ? lista.filter((e) => e.ativo) : lista;
  },

  async criar({ nome, descricao, ativo = true }) {
    return toEspecialidade(await especialidades.criar({ nome, descricao: descricao || null, ativo }));
  },

  // Quantas clínicas e profissionais usam a especialidade (o back-end não apaga em cascata).
  async contarUso(id) {
    const [c, p] = await Promise.all([clinicaEspecialidades.listar(), profEspecialidades.listar()]);
    return {
      clinicas: c.filter((x) => Number(x.id_especialidade) === Number(id)).length,
      profissionais: p.filter((x) => Number(x.id_especialidade) === Number(id)).length,
    };
  },

  async remover(id) {
    await especialidades.remover(id);
  },
};
