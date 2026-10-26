// Registra o service worker (funciona em HTTPS ou localhost).
// Também aplica as preferências de acessibilidade do aparelho assim que a página carrega o módulo.
import { aplicarAcessibilidade } from "./ui/acessibilidade.js";

aplicarAcessibilidade();
let registrado = false;

export function registrarPwa() {
  if (registrado || !("serviceWorker" in navigator)) return;
  registrado = true;
  const registrar = () => navigator.serviceWorker.register("sw.js").catch(() => {});
  if (document.readyState === "complete") registrar();
  else window.addEventListener("load", registrar, { once: true });
}
