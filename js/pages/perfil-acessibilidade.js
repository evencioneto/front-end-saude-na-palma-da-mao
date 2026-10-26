// Acessibilidade: tamanho do texto, alto contraste e menos animações. As escolhas ficam neste aparelho.
import { exigirLogin, PERFIS } from "../core/guard.js";
import { h, $ } from "../core/dom.js";
import { barraPac } from "../ui/fluxoPaciente.js";
import { TAMANHOS, lerAcessibilidade, gravarAcessibilidade } from "../ui/acessibilidade.js";
import { registrarPwa } from "../pwa.js";

function iniciar() {
  registrarPwa();
  $("#barra").replaceChildren(barraPac("Acessibilidade", "perfil.html"));
  const prefs = lerAcessibilidade();

  const botoes = TAMANHOS.map((t) =>
    h("button", {
      type: "button", role: "radio", class: "pac-tam", "data-valor": t.valor, "aria-checked": String(prefs.texto === t.valor),
      onclick: () => {
        prefs.texto = t.valor;
        gravarAcessibilidade(prefs);
        botoes.forEach((b) => b.setAttribute("aria-checked", String(b.dataset.valor === prefs.texto)));
      },
    }, t.rotulo),
  );

  const interruptor = (chave, titulo, texto) => {
    const idTitulo = `ac-${chave}`;
    const botao = h("button", { type: "button", role: "switch", class: "pac-chave", "aria-checked": String(prefs[chave]), "aria-labelledby": idTitulo, "aria-describedby": `${idTitulo}-d`, "data-chave": chave });
    botao.addEventListener("click", () => {
      prefs[chave] = !prefs[chave];
      botao.setAttribute("aria-checked", String(prefs[chave]));
      gravarAcessibilidade(prefs);
    });
    return h("section", { class: "pac-notif__item" }, h("div", { class: "pac-notif__texto" }, h("h2", { id: idTitulo }, titulo), h("p", { id: `${idTitulo}-d` }, texto)), botao);
  };

  $("#conteudo").replaceChildren(
    h("p", { class: "pac-acess__intro" }, "Configure o aplicativo para a sua necessidade."),
    h("section", { class: "pac-acess__tamanho" }, h("h2", { id: "ac-tamanho" }, "Tamanho do texto"), h("div", { class: "pac-acess__opcoes", role: "radiogroup", "aria-labelledby": "ac-tamanho" }, botoes)),
    interruptor("contraste", "Alto contraste", "Aumenta o contraste das cores para melhor visibilidade"),
    interruptor("reduzirAnimacoes", "Reduzir animações", "Diminui ou remove animações da interface"),
  );
}

const sessao = exigirLogin([PERFIS.PACIENTE]);
if (sessao) iniciar();
