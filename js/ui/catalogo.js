// Carrega, em paralelo, os cadastros que várias telas precisam e monta índices por id.
// A API não tem filtros, então a "junção" entre as tabelas é feita aqui, no cliente.
import { clinicaService } from "../services/clinicaService.js";
import { especialidadeService } from "../services/especialidadeService.js";
import { profissionalService } from "../services/profissionalService.js";
import { ApiError } from "../core/http.js";

// Clínicas e profissionais podem ser negados (403) a quem não é administrador: nesse caso usa os dados embutidos nos vínculos.
const ouPeloVinculo = (promessa, alternativa) => promessa.catch((erro) => (erro instanceof ApiError && erro.status === 403 ? alternativa() : Promise.reject(erro)));

export async function carregarCatalogo({ incluirInativos = false } = {}) {
  const apenasAtivas = !incluirInativos;
  const [clinicas, especialidades, profissionais, vinculos, clinEsp, profEsp] = await Promise.all([
    ouPeloVinculo(clinicaService.listar({ apenasAtivas }), () => clinicaService.listarPelosVinculos({ apenasAtivas })),
    especialidadeService.listar({ apenasAtivas }),
    ouPeloVinculo(profissionalService.listar(), () => profissionalService.listarPelosVinculos()),
    profissionalService.listarVinculos({ apenasAtivos: apenasAtivas }),
    clinicaService.listarEspecialidades(),
    profissionalService.listarEspecialidades(),
  ]);

  const porId = (lista) => new Map(lista.map((x) => [x.id, x]));
  const cat = {
    clinicas,
    especialidades,
    profissionais,
    vinculos,
    clinEsp,
    profEsp,
    clinicaPorId: porId(clinicas),
    especialidadePorId: porId(especialidades),
    profissionalPorId: porId(profissionais),
    vinculoPorId: porId(vinculos),
  };

  cat.rotuloVinculo = (idVinculo) => {
    const v = cat.vinculoPorId.get(idVinculo);
    if (!v) return "Profissional não encontrado";
    const p = cat.profissionalPorId.get(v.idProfissional);
    const c = cat.clinicaPorId.get(v.idClinica);
    return `${p?.nome ?? "Profissional"} — ${c?.nome ?? "Clínica"}`;
  };

  return cat;
}

export const nomesDasEspecialidades = (cat, ids) =>
  ids
    .map((id) => cat.especialidadePorId.get(id)?.nome)
    .filter(Boolean)
    .join(", ");
