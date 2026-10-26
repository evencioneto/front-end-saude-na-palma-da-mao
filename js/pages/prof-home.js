// Início do profissional: saudação, resumo do dia e atalhos.
import { exigirLogin, PERFIS } from "../core/guard.js";
import { h, $ } from "../core/dom.js";
import { registrarPwa } from "../pwa.js";
import { agoraHHMM } from "../core/datetime.js";
import { icone, montarNavProf } from "../ui/profissional.js";
import { carregarAgenda, doDia, ABERTOS } from "../ui/agendaProfissional.js";

// "Dr. Carlos Menezes" -> "Dr. Carlos"; "Carlos Menezes" -> "Carlos"
function nomeDeSaudacao(nome) {
  const partes = String(nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "";
  return /^(dr|dra)\.?$/i.test(partes[0]) ? partes.slice(0, 2).join(" ") : partes[0];
}

const ATALHOS = [
  ["prof-agenda.html", "calendario-card", "Minha agenda", "Visualize suas consultas de hoje e da semana"],
  ["prof-disponibilidade.html", "relogio", "Disponibilidade", "Configure seus horários disponíveis"],
  ["prof-historico.html", "check", "Histórico de consultas", "Consultas realizadas anteriormente"],
];

function iniciar(s) {
  registrarPwa();
  const nome = nomeDeSaudacao(s.nome);
  const qtd = h("strong", {}, "–");
  const proxima = h("strong", {}, "--:--");

  $("#conteudo").replaceChildren(
    h(
      "div",
      { class: "prof-home" },
      h(
        "header",
        { class: "prof-home__topo" },
        h("div", {}, h("h1", { class: "prof-home__ola" }, nome ? `Olá, ${nome}!` : "Olá!"), h("p", { class: "prof-home__sub" }, "Sua agenda de hoje")),
        h("span", { class: "prof-logo prof-logo--quadrado" }, icone("cruz-topo-grande", 20)),
      ),
      h(
        "section",
        { class: "prof-resumo", "aria-label": "Resumo do dia" },
        h("div", {}, h("p", {}, "Consultas hoje"), qtd),
        h("div", {}, h("p", {}, "Próxima às"), proxima),
      ),
      h(
        "nav",
        { class: "prof-atalhos", "aria-label": "Atalhos" },
        ATALHOS.map(([href, ic, titulo, texto]) =>
          h(
            "a",
            { class: "prof-atalho", href },
            h("span", { class: "prof-atalho__icone" }, icone(ic, 20)),
            h("span", { class: "prof-atalho__texto" }, h("strong", {}, titulo), h("span", {}, texto)),
            icone("seta-direita", 16),
          ),
        ),
      ),
    ),
  );
  montarNavProf("inicio");

  carregarAgenda(s)
    .then(({ meus }) => {
      const hoje = doDia(meus).filter((a) => a.status !== "CANCELADO");
      qtd.textContent = String(hoje.length);
      const abertas = hoje.filter((a) => ABERTOS.includes(a.status));
      const agora = agoraHHMM();
      const prox = abertas.find((a) => a.hora >= agora) ?? abertas[0];
      proxima.textContent = prox ? prox.hora : "--:--";
    })
    .catch(() => {
      qtd.textContent = "–";
    });
}

const sessao = exigirLogin([PERFIS.PROFISSIONAL]);
if (sessao) iniciar(sessao);
