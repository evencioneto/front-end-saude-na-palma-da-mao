import { API_URL, REQUEST_TIMEOUT_MS, SLOW_NOTICE_MS } from "../config.js";
import { sessao } from "./session.js";

export class ApiError extends Error {
  constructor(message, status = 0, data = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

let pendentes = 0;
const emitir = (nome) => window.dispatchEvent(new CustomEvent(nome));

// Cliente HTTP único. Services nunca chamam fetch diretamente.
// A API responde erros como { erro } (400/500) ou { mensagem } (404).
export async function http(path, { method = "GET", body, token } = {}) {
  // Content-Type só quando há corpo: em GET isso evita o pré-voo CORS (uma ida e volta a menos).
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const auth = token ?? sessao.get()?.token;
  if (auth) headers.Authorization = `Bearer ${auth}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const aviso = setTimeout(() => emitir("api:lenta"), SLOW_NOTICE_MS);
  pendentes++;

  try {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    const data = res.status === 204 ? null : await res.json().catch(() => null);

    if (!res.ok) {
      if (res.status === 401 && !path.startsWith("/auth/")) {
        sessao.limpar();
        location.href = "login.html";
      }
      const msg = data?.erro ?? data?.mensagem ?? `Erro ${res.status} ao falar com o servidor.`;
      throw new ApiError(msg, res.status, data);
    }
    return data;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err.name === "AbortError") {
      throw new ApiError("O servidor demorou demais para responder. Tente novamente.", 0);
    }
    throw new ApiError("Sem conexão com o servidor. Verifique sua internet.", 0);
  } finally {
    clearTimeout(timeout);
    clearTimeout(aviso);
    pendentes--;
    if (pendentes === 0) emitir("api:ociosa");
  }
}

// Fábrica de CRUD para recursos padrão da API.
export const crud = (base) => ({
  listar: () => http(base),
  buscar: (id) => http(`${base}/${id}`),
  criar: (dados) => http(base, { method: "POST", body: dados }),
  atualizar: (id, dados) => http(`${base}/${id}`, { method: "PUT", body: dados }),
  remover: (id) => http(`${base}/${id}`, { method: "DELETE" }),
});
