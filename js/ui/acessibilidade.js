// Preferências de acessibilidade do paciente. Ficam só neste aparelho (a API não tem onde guardá-las) e valem
// para todas as telas: o que muda é marcado em atributos do <html>, que o CSS (css/paciente.css) lê.
const CHAVE = "spm_acessibilidade";

export const TAMANHOS = [
  { valor: "normal", rotulo: "Normal" },
  { valor: "grande", rotulo: "Grande" },
  { valor: "extra", rotulo: "Extra-Grande" },
];

const PADRAO = { texto: "normal", contraste: false, reduzirAnimacoes: false };

export function lerAcessibilidade() {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE)) ?? {};
    return {
      texto: TAMANHOS.some((t) => t.valor === salvo.texto) ? salvo.texto : PADRAO.texto,
      contraste: salvo.contraste === true,
      reduzirAnimacoes: salvo.reduzirAnimacoes === true,
    };
  } catch {
    return { ...PADRAO };
  }
}

export function aplicarAcessibilidade(prefs = lerAcessibilidade()) {
  const raiz = document.documentElement;
  raiz.dataset.texto = prefs.texto;
  raiz.toggleAttribute("data-contraste", prefs.contraste);
  raiz.toggleAttribute("data-sem-animacao", prefs.reduzirAnimacoes);
}

export function gravarAcessibilidade(prefs) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(prefs));
  } catch {
    /* sem armazenamento: vale só até recarregar a página */
  }
  aplicarAcessibilidade(prefs);
}
