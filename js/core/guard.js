import { sessao } from "./session.js";

export const PERFIS = {
  PACIENTE: "PACIENTE",
  PROFISSIONAL: "PROFISSIONAL",
  ADMIN: "ADMINISTRADOR",
};

// Tela inicial de cada perfil depois do login.
export const paginaInicial = (tipo) => "agendamento.html";

// Protege uma página. Retorna a sessão, ou null se redirecionou.
// Atenção: isto é conveniência de interface, não segurança. Quem protege
// os dados de verdade é o back-end (que hoje ainda não tem autenticação).
export function exigirLogin(perfisPermitidos) {
  const s = sessao.get();
  if (!s) {
    location.replace("index.html");
    return null;
  }
  if (perfisPermitidos && !perfisPermitidos.includes(s.tipo)) {
    location.replace(paginaInicial(s.tipo));
    return null;
  }
  return s;
}
