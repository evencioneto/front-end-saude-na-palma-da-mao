// Junta, no cliente, o que as telas do paciente mostram de cada profissional (a API não tem filtros nem "visões").
// "Disponível" = profissional ativo com ao menos um vínculo ativo com uma clínica ativa. Horários livres não entram nessa conta.
export function resumoProfissional(cat, p) {
  const idsEsp = cat.profEsp.filter((x) => x.idProfissional === p.id).map((x) => x.idEspecialidade);
  const especialidades = idsEsp.map((id) => cat.especialidadePorId.get(id)?.nome).filter(Boolean);
  const vinculos = cat.vinculos.filter((v) => v.idProfissional === p.id);
  const clinicasAtivas = vinculos.filter((v) => v.ativo).map((v) => cat.clinicaPorId.get(v.idClinica)).filter((c) => c?.ativo);
  const clinica = clinicasAtivas[0] ?? cat.clinicaPorId.get(vinculos[0]?.idClinica) ?? null;
  return { idsEsp, especialidades, vinculos, clinica, disponivel: p.ativo && clinicasAtivas.length > 0 };
}

// "CRM 12345-PE"
export const registroProfissional = (p) => [[p.conselho, p.registro].filter(Boolean).join(" "), p.uf].filter(Boolean).join("-");
