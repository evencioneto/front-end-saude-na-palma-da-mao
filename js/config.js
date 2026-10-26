// Configuração central do front-end.
export const API_URL =
  typeof location !== "undefined" && location.hostname.includes("onrender.com")
    ? "https://backend-saude-na-palma-da-mao-express.onrender.com/api/v1"
    : "http://localhost:3000/api/v1";

export const SESSION_KEY = "spm_sessao";

// O back-end no Render (plano gratuito) "dorme" e a primeira chamada pode levar ~1 min.
export const REQUEST_TIMEOUT_MS = 70000;
export const SLOW_NOTICE_MS = 4000;

// data_hora é gravado como "timestamp" sem fuso. O servidor devolve ISO com "Z".
// Esta aplicação trata o valor como HORÁRIO DE PAREDE (08:00 enviado => 08:00 exibido),
// o que funciona quando o servidor roda em UTC (Render).
// Se um agendamento de teste aparecer deslocado, ajuste aqui (ex.: -180 ou 180 minutos).
export const DATAHORA_OFFSET_MIN = 0;
