// Notificações do paciente: preferências de aviso.
// A API ainda não tem canal de aviso nem preferências, então a escolha fica guardada só neste aparelho.
import { exigirLogin, PERFIS } from "../core/guard.js";
import { h, $ } from "../core/dom.js";
import { barraPac } from "../ui/fluxoPaciente.js";
import { montarNavPaciente } from "../ui/navPaciente.js";
import { registrarPwa } from "../pwa.js";

const OPCOES = [
  { chave: "confirmacoes", titulo: "Confirmações de consulta", texto: "Receba notificações quando uma consulta for confirmada", padrao: true },
  { chave: "lembretes", titulo: "Lembretes", texto: "Lembrete 24h antes da sua consulta", padrao: true },
  { chave: "novidades", titulo: "Novidades", texto: "Informações sobre novas funcionalidades", padrao: false },
];

const chaveDe = (s) => `spm_notificacoes_${s.idUsuario}`;

function ler(s) {
  try {
    const salvo = JSON.parse(localStorage.getItem(chaveDe(s)));
    return salvo && typeof salvo === "object" ? salvo : {};
  } catch {
    return {};
  }
}

function gravar(s, valores) {
  try {
    localStorage.setItem(chaveDe(s), JSON.stringify(valores));
  } catch {
    /* armazenamento indisponível: vale só até recarregar a página */
  }
}

function iniciar(s) {
  registrarPwa();
  // De onde veio: do Perfil volta para o Perfil; pela barra inferior, volta para o início.
  const veioDoPerfil = /perfil\.html$/.test(document.referrer);
  $("#barra").replaceChildren(barraPac("Notificações", veioDoPerfil ? "perfil.html" : "home.html"));
  montarNavPaciente("avisos");

  const salvo = ler(s);
  const valores = Object.fromEntries(OPCOES.map((o) => [o.chave, typeof salvo[o.chave] === "boolean" ? salvo[o.chave] : o.padrao]));

  $("#conteudo").replaceChildren(
    ...OPCOES.map((o) => {
      const idTitulo = `notif-${o.chave}`;
      const chave = h("button", { type: "button", role: "switch", class: "pac-chave", "aria-checked": String(valores[o.chave]), "aria-labelledby": idTitulo, "aria-describedby": `${idTitulo}-d`, "data-chave": o.chave });
      chave.addEventListener("click", () => {
        valores[o.chave] = !valores[o.chave];
        chave.setAttribute("aria-checked", String(valores[o.chave]));
        gravar(s, valores);
      });
      return h(
        "section",
        { class: "pac-notif__item" },
        h("div", { class: "pac-notif__texto" }, h("h2", { id: idTitulo }, o.titulo), h("p", { id: `${idTitulo}-d` }, o.texto)),
        chave,
      );
    }),
  );
}

const sessao = exigirLogin([PERFIS.PACIENTE]);
if (sessao) iniciar(sessao);
