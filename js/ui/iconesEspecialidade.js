// Ícone da especialidade pelo nome (o Figma tem um por área); sem correspondência, usa o de ortopedia.
const ICONES = [
  [/traumat/i, "esp-traumatologia"],
  [/esport/i, "esp-esportiva"],
  [/coluna/i, "esp-coluna"],
  [/joelho/i, "esp-joelho"],
  [/ombro/i, "esp-ombro"],
  [/m[aã]o|punho/i, "esp-mao"],
  [/fisio|reabilit|fortalec|preven/i, "esp-fisioterapia"],
];

export const iconeEspecialidade = (nome) => ICONES.find(([r]) => r.test(nome))?.[1] ?? "esp-ortopedia";
