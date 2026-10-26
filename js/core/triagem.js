// Pré-triagem por regras simples (sem IA e sem back-end): sugere a especialidade pelo que o paciente descreveu.
// É uma ORIENTAÇÃO inicial, nunca um diagnóstico. A tela sempre avisa que não substitui avaliação médica.
// Quando existir um serviço de triagem no back-end, só orientar() precisa ser trocada.
export const normalizar = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const TERMOS = {
  FISIOTERAPIA: [
    "reabilit", "fisioterapia", "fortalec", "pos-operatorio", "pos operatorio", "pos cirurgia", "cirurgia", "recuperacao",
    "mobilidade", "rigidez", "postura", "alongamento", "contratura", "tensao muscular", "atrofia", "amplitude",
  ],
  ORTOPEDIA: [
    "joelho", "ombro", "coluna", "quadril", "osso", "fratura", "entorse", "torcao", "lesao", "inchaco", "tornozelo", "punho",
    "cotovelo", "costas", "pescoco", "queda", "luxacao", "tendao", "ligamento", "articulacao", "menisco", "hernia", "dor",
  ],
};

// Sinais de que a pessoa deve procurar atendimento de urgência em vez de agendar (texto já sem acentos).
const ALERTAS = [
  /fratura exposta/, /osso exposto/, /osso.{0,20}\bfora\b/, /deformad/,
  /nao (consigo|posso) (mais )?(mexer|mover|andar|levantar|apoiar|pisar|dobrar|esticar)/,
  /dormenci|formigament/, /perda de forca|sem forca/, /atropel|acidente grave|acidente de (carro|moto|transito)/,
  /desmai/, /falta de ar|dor no peito/, /sangrament|hemorragia/, /insuportav|dor (muito )?intensa|muito forte/,
];

export const OPCOES_RAPIDAS = { febre: "febre", dor: "dor", inchaco: "inchaço", lesao: "lesão", limitacao: "limitação de movimento" };

export const MENSAGEM_URGENCIA =
  "Pelo que você descreveu, procure um pronto-atendimento ou ligue para o SAMU (192) agora, sem esperar uma consulta.";

// orientar({ texto, rapidas: ["febre","dor"] }) -> { area, urgente }
export function orientar({ texto = "", rapidas = [] } = {}) {
  const tudo = normalizar(`${texto} ${rapidas.map((r) => OPCOES_RAPIDAS[r] ?? r).join(" ")}`);
  const pontos = (termos) => termos.filter((t) => tudo.includes(t)).length;
  const fisio = pontos(TERMOS.FISIOTERAPIA);
  const orto = pontos(TERMOS.ORTOPEDIA);
  const febreComInchaco = tudo.includes("febre") && (tudo.includes("inchaco") || tudo.includes("vermelh") || tudo.includes("quente"));
  return {
    // Sem pistas claras, a avaliação ortopédica é a porta de entrada.
    area: fisio > orto ? "FISIOTERAPIA" : "ORTOPEDIA",
    urgente: febreComInchaco || ALERTAS.some((a) => a.test(tudo)),
  };
}

// Qual especialidade cadastrada na API corresponde à área sugerida.
export const PADRAO_DA_AREA = { ORTOPEDIA: /ortop/i, FISIOTERAPIA: /fisio|reabilit/i };
