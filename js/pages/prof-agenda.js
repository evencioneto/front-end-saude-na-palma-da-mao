// Minha agenda (consultas de hoje) + folha "Cancelar consulta" + estado "Cancelada" com justificativa.
import { exigirLogin, PERFIS } from "../core/guard.js";
import { h, $, carregando, toast, comBotaoOcupado } from "../core/dom.js";
import { registrarPwa } from "../pwa.js";
import { hojeISO } from "../core/datetime.js";
import { agendamentoService } from "../services/agendamentoService.js";
import { barraProf, montarNavProf, dataBR, maiuscula } from "../ui/profissional.js";
import { carregarAgenda, doDia, atualizarSelos, montarObservacao, ABERTOS } from "../ui/agendaProfissional.js";

let meus = [];
let corpo;

const rotuloHoje = () => {
  const [y, m, d] = hojeISO().split("-").map(Number);
  const dia = maiuscula(new Date(y, m - 1, d).toLocaleDateString("pt-BR", { weekday: "long" }));
  return `Hoje · ${dia}, ${dataBR(hojeISO())}`;
};

const CHIP = {
  CANCELADO: ["cancelada", "Cancelada"],
  CONCLUIDO: ["concluida", "Concluída"],
};

function cartao(a) {
  const aberta = ABERTOS.includes(a.status);
  const [classe, texto] = CHIP[a.status] ?? ["proxima", "Próxima"];

  const rodape = a.status === "CANCELADO"
    ? h(
        "p",
        { class: "prof-consulta__rodape prof-justificativa" },
        h("strong", {}, "Justificativa:"),
        " ",
        a.justificativa || "Não informada",
      )
    : aberta
      ? h(
          "div",
          { class: "prof-consulta__rodape" },
          h("button", { class: "prof-cancelar", type: "button", onclick: () => abrirFolha(a) }, "Cancelar consulta"),
        )
      : null;

  return h(
    "article",
    { class: "prof-cartao prof-consulta" },
    h(
      "div",
      { class: "prof-consulta__linha" },
      h("span", { class: `prof-consulta__hora${a.status === "CANCELADO" ? " prof-consulta__hora--cancelada" : ""}` }, a.hora),
      h("span", { class: "prof-consulta__divisor", "aria-hidden": "true" }),
      h("div", { class: "prof-consulta__quem" }, h("strong", {}, a.paciente), h("span", {}, a.especialidade)),
      h("span", { class: `prof-chip prof-chip--${classe}` }, texto),
    ),
    rodape,
  );
}

function desenharLista() {
  const hoje = doDia(meus);
  corpo.replaceChildren(
    h("p", { class: "prof-data-hoje" }, rotuloHoje()),
    hoje.length
      ? h("div", { class: "prof-lista" }, hoje.map(cartao))
      : h("p", { class: "prof-vazio" }, "Nenhuma consulta para hoje."),
  );
}

function abrirFolha(a) {
  const anterior = document.activeElement;
  const campo = h("textarea", {
    id: "justificativa",
    maxlength: "200",
    rows: "4",
    placeholder: "Ex.: indisponibilidade médica ou emergência",
  });
  const confirmar = h("button", { class: "prof-botao prof-botao--primario", type: "button", disabled: true }, "Confirmar");
  const fechar = () => {
    fundo.remove();
    document.removeEventListener("keydown", aoTeclar);
    anterior?.focus?.();
  };
  const aoTeclar = (e) => e.key === "Escape" && fechar();

  campo.addEventListener("input", () => (confirmar.disabled = campo.value.trim().length === 0));
  confirmar.addEventListener("click", async () => {
    try {
      await comBotaoOcupado(confirmar, "Salvando...", () =>
        agendamentoService.cancelarComJustificativa(a.id, montarObservacao(a.observacao, campo.value.trim())),
      );
      a.status = "CANCELADO";
      a.justificativa = campo.value.trim();
      a.observacao = montarObservacao(a.observacao, a.justificativa);
      atualizarSelos(meus);
      fechar();
      toast("Consulta cancelada. O paciente será notificado.", "sucesso");
      desenharLista();
    } catch (err) {
      toast(err.message, "erro");
    }
  });

  const fundo = h(
    "div",
    { class: "prof-folha-fundo", onclick: (e) => e.target === fundo && fechar() },
    h(
      "div",
      { class: "prof-folha", role: "dialog", "aria-modal": "true", "aria-labelledby": "folha-titulo" },
      h("h2", { id: "folha-titulo" }, "Cancelar consulta"),
      h("p", { class: "prof-folha__texto" }, "Informe a justificativa. O paciente será notificado sobre o cancelamento."),
      h("label", { for: "justificativa" }, "Justificativa do cancelamento"),
      campo,
      h(
        "div",
        { class: "prof-folha__acoes" },
        h("button", { class: "prof-botao", type: "button", onclick: fechar }, "Voltar"),
        confirmar,
      ),
    ),
  );
  document.body.append(fundo);
  document.addEventListener("keydown", aoTeclar);
  campo.focus();
}

async function iniciar(s) {
  registrarPwa();
  corpo = h("div", { class: "prof-corpo" }, carregando("Carregando agenda..."));
  $("#conteudo").replaceChildren(barraProf("Minha agenda"), corpo);
  montarNavProf("agenda");

  try {
    const r = await carregarAgenda(s);
    if (r.semCadastro) {
      corpo.replaceChildren(h("p", { class: "prof-vazio" }, "Seu usuário ainda não tem cadastro de profissional."));
      return;
    }
    meus = r.meus;
    desenharLista();
  } catch (err) {
    corpo.replaceChildren(h("p", { class: "prof-vazio", role: "alert" }, err.message));
  }
}

const sessao = exigirLogin([PERFIS.PROFISSIONAL]);
if (sessao) iniciar(sessao);
