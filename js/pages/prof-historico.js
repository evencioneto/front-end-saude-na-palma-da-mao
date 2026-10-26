// Histórico de consultas concluídas do profissional.
import { exigirLogin, PERFIS } from "../core/guard.js";
import { h, $, carregando } from "../core/dom.js";
import { registrarPwa } from "../pwa.js";
import { barraProf, montarNavProf, dataBR } from "../ui/profissional.js";
import { carregarAgenda } from "../ui/agendaProfissional.js";

async function iniciar(s) {
  registrarPwa();
  const corpo = h("div", { class: "prof-corpo" }, carregando("Carregando histórico..."));
  $("#conteudo").replaceChildren(barraProf("Histórico de consultas"), corpo);
  montarNavProf(null);

  try {
    const r = await carregarAgenda(s);
    if (r.semCadastro) {
      corpo.replaceChildren(h("p", { class: "prof-vazio" }, "Seu usuário ainda não tem cadastro de profissional."));
      return;
    }
    const feitas = r.meus
      .filter((a) => a.status === "CONCLUIDO")
      .sort((a, b) => `${b.data} ${b.hora}`.localeCompare(`${a.data} ${a.hora}`));

    corpo.replaceChildren(
      feitas.length
        ? h(
            "div",
            { class: "prof-lista" },
            feitas.map((a) =>
              h(
                "article",
                { class: "prof-cartao prof-cartao--suave" },
                h("p", { class: "prof-hist__nome" }, a.paciente),
                h("p", { class: "prof-hist__esp" }, a.especialidade),
                h(
                  "div",
                  { class: "prof-hist__quando" },
                  h("span", {}, `${dataBR(a.data)} · ${a.hora}`),
                  h("span", { class: "prof-chip prof-chip--concluida" }, "Concluída"),
                ),
              ),
            ),
          )
        : h("p", { class: "prof-vazio" }, "Nenhuma consulta concluída ainda."),
    );
  } catch (err) {
    corpo.replaceChildren(h("p", { class: "prof-vazio", role: "alert" }, err.message));
  }
}

const sessao = exigirLogin([PERFIS.PROFISSIONAL]);
if (sessao) iniciar(sessao);
