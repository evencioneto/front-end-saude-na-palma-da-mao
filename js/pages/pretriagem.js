// Pré-triagem em formato de chat com a TrIA: o paciente escreve, escolhe uma opção rápida ou grava um áudio.
// Não há IA nem back-end de triagem: a orientação sai de regras simples (js/core/triagem.js) aplicadas ao
// texto e às opções escolhidas, na tela de resultado. O ÁUDIO É GRAVADO E FICA SÓ NO APARELHO: não existe
// endpoint para enviá-lo nem transcrição, então ele não entra na orientação.
import { exigirLogin, PERFIS } from "../core/guard.js";
import { h, $ } from "../core/dom.js";
import { registrarPwa } from "../pwa.js";

const LIMITE = 500;
const MAX_SEGUNDOS = 120;
const CHAVE = "spm_triagem"; // { texto, rapidas, audios } lido pela tela de resultado
const CHIPS = [
  ["febre", "Febre"],
  ["dor", "Dor"],
  ["inchaco", "Inchaço"],
  ["lesao", "Lesão"],
  ["limitacao", "Limitação de movimento"],
];

const img = (nome, extra = {}) => h("img", { src: `icons/pac/${nome}`, alt: "", "aria-hidden": "true", ...extra });
const mmss = (seg) => `${String(Math.floor(seg / 60)).padStart(2, "0")}:${String(seg % 60).padStart(2, "0")}`;

const e = {
  textos: [], // o que o paciente escreveu (cada mensagem enviada)
  rapidas: new Set(),
  audios: 0,
  concluida: false,
  gravacao: null, // { recorder, stream, chunks, inicio, timer }
  audio: null, // { url, seg, tocador }
};
let ui = {};
let ultimoGrupo = null; // grupo de mensagens da TrIA em andamento (só a primeira do grupo leva avatar)

// ---------- persistência para a tela de resultado ----------
function salvar() {
  try {
    sessionStorage.setItem(CHAVE, JSON.stringify({ texto: e.textos.join(". "), rapidas: [...e.rapidas], audios: e.audios }));
  } catch {
    /* sem armazenamento: a tela de resultado pede para refazer */
  }
}

// ---------- construção da tela ----------
function montar() {
  ui.voltar = h("button", { class: "pac-voltar", type: "button", "aria-label": "Voltar", onclick: () => (location.href = "home.html") }, img("voltar.svg"));
  ui.mais = h(
    "button",
    { class: "pac-mais", type: "button", "aria-label": "Mais opções", "aria-haspopup": "true", "aria-expanded": "false", onclick: alternarMenu },
    img("mais.svg"),
  );
  ui.resultadoBtn = h("a", { class: "pac-resultado-btn", href: "pretriagem-resultado.html", hidden: true }, "Ver resultado");
  ui.menu = h("div", { class: "pac-menu", role: "menu", hidden: true }, h("button", { type: "button", role: "menuitem", onclick: recomecar }, "Recomeçar conversa"));

  const topo = h(
    "header",
    { class: "pac-chat__topo" },
    ui.voltar,
    h(
      "div",
      { class: "pac-tria" },
      h("span", { class: "pac-avatar" }, img("robo.svg")),
      h("div", {}, h("h1", { class: "pac-tria__nome" }, "TrIA"), h("p", { class: "pac-tria__estado" }, "online")),
    ),
    ui.mais,
    ui.resultadoBtn,
    ui.menu,
  );

  ui.conversa = h("main", { class: "pac-conversa", id: "conversa", role: "log", "aria-live": "polite", "aria-label": "Conversa com a TrIA", tabindex: "-1" });
  ui.status = h("p", { class: "pac-sr", role: "status" });

  // Barra de mensagem
  ui.campo = h("textarea", {
    class: "pac-campo",
    id: "mensagem",
    rows: "2",
    maxlength: String(LIMITE),
    placeholder: "Digite ou grave o que está sentindo...",
    "aria-label": "Digite o que está sentindo",
    oninput: atualizar,
    onkeydown: (ev) => {
      if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        enviar();
      }
    },
  });
  ui.mic = h("button", { class: "pac-btn-redondo", id: "mic", type: "button", "aria-label": "Gravar áudio", "aria-pressed": "false", onclick: alternarGravacao }, img("microfone.svg"));
  ui.enviar = h("button", { class: "pac-btn-redondo", id: "enviar", type: "button", "aria-label": "Enviar", disabled: true, onclick: enviar }, img("enviar.svg"));
  ui.nota = h("p", { class: "pac-compor__nota", hidden: true });
  ui.tempoNota = h("span", { "aria-hidden": "true" }, "00:00");
  ui.cartaoAudio = h("section", { class: "pac-audio", id: "audio-pronto", "aria-label": "Áudio gravado", hidden: true });

  const compor = h(
    "div",
    { class: "pac-compor" },
    ui.cartaoAudio,
    h("div", { class: "pac-compor__linha" }, ui.mic, ui.campo, ui.enviar),
    ui.nota,
  );

  $("#conteudo").replaceChildren(topo, ui.conversa, compor, ui.status);
  document.addEventListener("click", (ev) => {
    if (!ui.menu.hidden && !ev.target.closest(".pac-menu, .pac-mais")) fecharMenu();
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && !ui.menu.hidden) {
      fecharMenu();
      ui.mais.focus();
    }
  });
  window.addEventListener("pagehide", () => {
    cancelarGravacao();
    descartarAudio();
  });
}

function alternarMenu() {
  const abrir = ui.menu.hidden;
  ui.menu.hidden = !abrir;
  ui.mais.setAttribute("aria-expanded", String(abrir));
  if (abrir) ui.menu.querySelector("button").focus();
}
function fecharMenu() {
  ui.menu.hidden = true;
  ui.mais.setAttribute("aria-expanded", "false");
}

// ---------- mensagens ----------
function rolar() {
  ui.conversa.scrollTop = ui.conversa.scrollHeight;
}
function anunciar(texto) {
  ui.status.textContent = texto;
}

function balaoTria({ titulo, tituloImg, paragrafos = [], primeira, hora = true }) {
  const corpo = [
    titulo ? h("p", { class: "pac-balao__titulo" }, titulo, tituloImg ? img(tituloImg) : null) : null,
    ...paragrafos.map((p) => h("p", { class: "pac-balao__texto" }, p)),
    hora ? h("p", { class: "pac-balao__hora" }, "agora") : null,
  ];
  const balao = h("div", { class: hora ? "pac-balao" : "pac-balao pac-balao--sem-hora" }, corpo);
  if (!primeira) return h("div", { class: "pac-linha" }, balao);
  return h("div", { class: "pac-linha" }, h("span", { class: "pac-avatar pac-avatar--p" }, img("robo.svg")), balao);
}

function novoGrupo() {
  ultimoGrupo = h("div", { class: "pac-grupo" });
  ui.conversa.append(ultimoGrupo);
  return ultimoGrupo;
}

function saudacao() {
  const g = novoGrupo();
  g.append(
    balaoTria({ titulo: "Olá! Sou TrIA ", tituloImg: "emoji-aceno.png", paragrafos: ["Estou aqui para te ajudar a entender o que está acontecendo e indicar o melhor caminho para o seu atendimento."], primeira: true }),
  );
  const segunda = h("div", { class: "pac-linha" });
  const b = h("div", { class: "pac-balao" }, h("p", { class: "pac-balao__texto pac-balao__texto--curto" }, "O que está te incomodando? Pode descrever com suas palavras ou escolher uma das opções abaixo. ", img("emoji-sorriso.png")), h("p", { class: "pac-balao__hora" }, "agora"));
  segunda.append(b);
  g.append(segunda);

  ui.chips = h(
    "div",
    { class: "pac-chips", role: "group", "aria-label": "Opções rápidas" },
    ...CHIPS.map(([chave, rotulo]) =>
      h("button", { class: "pac-chip", type: "button", "data-chave": chave, onclick: () => enviarMensagem(rotulo, { rapida: chave }) }, h("span", { class: "pac-chip__icone" }, img(`${chave}.svg`)), rotulo),
    ),
    h("button", { class: "pac-chip", type: "button", id: "outro", onclick: () => ui.campo.focus() }, h("span", { class: "pac-chip__icone" }, img("outro.svg")), "Outro"),
  );
  ui.conversa.append(ui.chips);
  ultimoGrupo = null;
}

function balaoUsuario(texto, { audio = false } = {}) {
  const hora = h("p", { class: "pac-balao__hora" }, "agora ", h("span", { "aria-hidden": "true" }, "✓✓"), h("span", { class: "pac-sr" }, "enviada"));
  const b = h("div", { class: "pac-balao pac-balao--usuario" }, h("p", { class: "pac-balao__texto", "data-tipo": audio ? "audio" : "texto" }, texto), hora);
  return h("div", { class: "pac-linha pac-linha--usuario" }, b);
}

function enviarMensagem(texto, { rapida, audio = false } = {}) {
  ui.chips?.remove();
  ui.chips = null;
  ultimoGrupo = null;
  const linha = balaoUsuario(texto, { audio });
  ui.conversa.append(h("div", { class: "pac-grupo" }, linha));
  if (audio) e.audios += 1;
  else e.textos.push(texto.trim());
  if (rapida) e.rapidas.add(rapida);
  salvar();
  rolar();
  if (!e.concluida) concluir();
}

function concluir() {
  e.concluida = true;
  setTimeout(() => {
    const g = novoGrupo();
    g.append(balaoTria({ titulo: "Sua triagem foi concluída.", paragrafos: ["O resultado está pronto para você consultar."], primeira: true, hora: false }));
    ui.conversa.append(
      h(
        "section",
        { class: "pac-resultado", "aria-label": "Resultado da triagem" },
        h("p", { class: "pac-resultado__titulo" }, "Resultado da triagem disponível"),
        h("a", { class: "pac-resultado__botao", id: "ver-resultado", href: "pretriagem-resultado.html" }, img("ok.svg"), "Ver resultado da triagem"),
        h("p", { class: "pac-resultado__nota" }, "Você pode continuar enviando mensagens ou áudios abaixo."),
      ),
    );
    ui.mais.hidden = true;
    ui.resultadoBtn.hidden = false;
    anunciar("Sua triagem foi concluída. O resultado está pronto para você consultar.");
    rolar();
  }, 500);
}

function recomecar() {
  fecharMenu();
  cancelarGravacao();
  descartarAudio();
  e.textos = [];
  e.rapidas.clear();
  e.audios = 0;
  e.concluida = false;
  try {
    sessionStorage.removeItem(CHAVE);
  } catch {
    /* ignora */
  }
  ui.conversa.replaceChildren();
  ui.mais.hidden = false;
  ui.resultadoBtn.hidden = true;
  ui.campo.value = "";
  saudacao();
  atualizar();
  anunciar("Conversa reiniciada.");
}

// ---------- envio ----------
function enviar() {
  const texto = ui.campo.value.trim();
  if (e.gravacao) return;
  if (!texto && !e.audio) return;
  if (texto) {
    ui.campo.value = "";
    enviarMensagem(texto);
  }
  if (e.audio) {
    descartarAudio();
    enviarMensagem("Mensagem de áudio enviada", { audio: true });
  }
  atualizar();
  ui.campo.focus();
}

function atualizar() {
  const gravando = Boolean(e.gravacao);
  ui.enviar.disabled = gravando || !(ui.campo.value.trim().length > 0 || e.audio);
}

// ---------- áudio ----------
function avisoMic(texto) {
  ui.nota.hidden = false;
  ui.nota.setAttribute("role", "alert");
  ui.nota.textContent = texto;
  clearTimeout(avisoMic.t);
  avisoMic.t = setTimeout(() => {
    if (!e.gravacao) ui.nota.hidden = true;
  }, 6000);
}

function escolherTipo() {
  if (typeof MediaRecorder === "undefined") return null;
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((t) => MediaRecorder.isTypeSupported?.(t)) ?? "";
}

async function alternarGravacao() {
  if (e.gravacao) return pararGravacao();
  const tipo = escolherTipo();
  if (tipo === null || !navigator.mediaDevices?.getUserMedia) {
    return avisoMic("A gravação de áudio não está disponível neste aparelho. Digite sua mensagem.");
  }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    return avisoMic("Não foi possível usar o microfone. Permita o acesso ou digite sua mensagem.");
  }
  descartarAudio();
  const recorder = tipo ? new MediaRecorder(stream, { mimeType: tipo }) : new MediaRecorder(stream);
  const g = { recorder, stream, chunks: [], inicio: Date.now(), timer: null, tipo: recorder.mimeType || tipo || "audio/webm" };
  recorder.ondataavailable = (ev) => ev.data.size && g.chunks.push(ev.data);
  recorder.onstop = () => finalizarGravacao(g);
  e.gravacao = g;
  recorder.start();

  ui.mic.classList.add("pac-btn-redondo--gravando");
  ui.mic.setAttribute("aria-pressed", "true");
  ui.mic.setAttribute("aria-label", "Parar gravação");
  ui.mic.replaceChildren(img("parar.svg"));
  ui.campo.value = "";
  ui.campo.disabled = true;
  ui.campo.placeholder = "Gravando áudio...";
  ui.nota.hidden = false;
  ui.nota.removeAttribute("role");
  ui.nota.replaceChildren(h("span", { "aria-hidden": "true" }, "Gravando áudio · ", ui.tempoNota, " · toque novamente para parar"));
  ui.tempoNota.textContent = "00:00";
  anunciar("Gravando áudio. Toque novamente para parar.");
  g.timer = setInterval(() => {
    const seg = Math.floor((Date.now() - g.inicio) / 1000);
    ui.tempoNota.textContent = mmss(seg);
    if (seg >= MAX_SEGUNDOS) pararGravacao();
  }, 250);
  atualizar();
}

function encerrarEstadoGravando() {
  ui.mic.classList.remove("pac-btn-redondo--gravando");
  ui.mic.setAttribute("aria-pressed", "false");
  ui.mic.setAttribute("aria-label", "Gravar áudio");
  ui.mic.replaceChildren(img("microfone.svg"));
  ui.campo.disabled = false;
  ui.campo.placeholder = "Digite ou grave o que está sentindo...";
  ui.nota.hidden = true;
  ui.nota.replaceChildren();
}

function pararGravacao() {
  const g = e.gravacao;
  if (!g) return;
  clearInterval(g.timer);
  g.seg = Math.max(1, Math.round((Date.now() - g.inicio) / 1000));
  if (g.recorder.state !== "inactive") g.recorder.stop();
  else finalizarGravacao(g);
}

function finalizarGravacao(g) {
  g.stream.getTracks().forEach((t) => t.stop());
  if (e.gravacao !== g) return; // cancelada
  e.gravacao = null;
  encerrarEstadoGravando();
  const blob = new Blob(g.chunks, { type: g.tipo });
  if (!blob.size) {
    avisoMic("Não conseguimos gravar o áudio. Tente de novo ou digite sua mensagem.");
    return atualizar();
  }
  mostrarAudio(blob, g.seg ?? 1);
}

function cancelarGravacao() {
  const g = e.gravacao;
  if (!g) return;
  clearInterval(g.timer);
  e.gravacao = null;
  try {
    if (g.recorder.state !== "inactive") g.recorder.stop();
  } catch {
    /* já parou */
  }
  g.stream.getTracks().forEach((t) => t.stop());
  encerrarEstadoGravando();
}

const ICONE_PAUSA =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="8.5" y="7.5" width="2.6" height="9" rx="0.8" fill="#fff"/><rect x="12.9" y="7.5" width="2.6" height="9" rx="0.8" fill="#fff"/></svg>';

function mostrarAudio(blob, seg) {
  const url = URL.createObjectURL(blob);
  const tocador = new Audio(url);
  const progresso = h("span", {});
  const tocar = h("button", { class: "pac-player__tocar", type: "button", "aria-label": "Ouvir áudio gravado", onclick: () => (tocador.paused ? tocador.play().catch(() => {}) : tocador.pause()) }, img("tocar.svg"));
  const marcar = (tocando) => {
    tocar.setAttribute("aria-label", tocando ? "Pausar áudio" : "Ouvir áudio gravado");
    if (tocando) tocar.innerHTML = ICONE_PAUSA;
    else tocar.replaceChildren(img("tocar.svg"));
  };
  tocador.addEventListener("play", () => marcar(true));
  tocador.addEventListener("pause", () => marcar(false));
  tocador.addEventListener("ended", () => {
    progresso.style.width = "0";
    marcar(false);
  });
  tocador.addEventListener("timeupdate", () => {
    progresso.style.width = `${Math.min(100, (tocador.currentTime / seg) * 100)}%`;
  });
  e.audio = { url, seg, tocador };

  ui.cartaoAudio.replaceChildren(
    h("div", { class: "pac-audio__topo" }, h("p", { class: "pac-audio__titulo" }, "Áudio pronto para enviar"), h("button", { class: "pac-audio__remover", type: "button", id: "remover-audio", onclick: () => { descartarAudio(); atualizar(); ui.mic.focus(); anunciar("Áudio removido."); } }, "Remover")),
    h("div", { class: "pac-player" }, tocar, h("div", { class: "pac-player__trilha", "aria-hidden": "true" }, progresso), h("span", { class: "pac-player__tempo" }, mmss(seg))),
  );
  ui.cartaoAudio.hidden = false;
  anunciar(`Áudio gravado, ${seg} ${seg === 1 ? "segundo" : "segundos"}. Pronto para enviar.`);
  atualizar();
}

function descartarAudio() {
  if (!e.audio) return;
  e.audio.tocador.pause();
  URL.revokeObjectURL(e.audio.url);
  e.audio = null;
  ui.cartaoAudio.hidden = true;
  ui.cartaoAudio.replaceChildren();
}

function iniciar() {
  registrarPwa();
  document.title = "Pré-triagem | TriaOrto+";
  try {
    sessionStorage.removeItem(CHAVE); // cada visita à tela começa uma triagem nova
  } catch {
    /* ignora */
  }
  montar();
  saudacao();
  atualizar();
}

const sessao = exigirLogin([PERFIS.PACIENTE]);
if (sessao) iniciar();
