// Minhas consultas (paciente): abas Próximas, Concluídas e Canceladas, com a opção de cancelar uma consulta futura.
import { exigirLogin, PERFIS } from "../core/guard.js";
import { h, $, toast, comBotaoOcupado } from "../core/dom.js";
import { avisoDeErro } from "../ui/layout.js";
import { barraPac, iconePac } from "../ui/fluxoPaciente.js";
import { montarNavPaciente, definirSelo } from "../ui/navPaciente.js";
import { confirmarPac } from "../ui/dialogoPaciente.js";
import { carregarCatalogo } from "../ui/catalogo.js";
import { agendamentoService, contarConsultasEmAberto } from "../services/agendamentoService.js";
import { dataCurta, hojeISO, agoraHHMM } from "../core/datetime.js";
import { registrarPwa } from "../pwa.js";

const ABAS = [
  { chave: "proximas", rotulo: "Próximas" },
  { chave: "concluidas", rotulo: "Concluídas" },
  { chave: "canceladas", rotulo: "Canceladas" },
];
const ROTULO_STATUS = { PENDENTE: "Pendente", CONFIRMADO: "Confirmada", CONCLUIDO: "Concluída", CANCELADO: "Cancelada" };
const VAZIO = {
  proximas: "Você não tem consultas marcadas.",
  concluidas: "Você ainda não tem consultas concluídas.",
  canceladas: "Você não tem consultas canceladas.",
};

let eu, cat, todas;
let abaAtual = "proximas";

const quando = (a) => `${a.data} ${a.hora}`;

// Separa as consultas do paciente em cada aba. Consulta em aberto que já passou fica em "Concluídas" como "Encerrada".
function separar(lista) {
  const agora = `${hojeISO()} ${agoraHHMM()}`;
  const emAberto = (a) => ["PENDENTE", "CONFIRMADO"].includes(a.status);
  const crescente = (a, b) => quando(a).localeCompare(quando(b));
  const decrescente = (a, b) => quando(b).localeCompare(quando(a));
  return {
    proximas: lista.filter((a) => emAberto(a) && quando(a) >= agora).sort(crescente),
    concluidas: lista.filter((a) => a.status === "CONCLUIDO" || (emAberto(a) && quando(a) < agora)).sort(decrescente),
    canceladas: lista.filter((a) => a.status === "CANCELADO").sort(decrescente),
  };
}

async function iniciar(s) {
  eu = s;
  registrarPwa();
  $("#barra").replaceChildren(barraPac("Minhas consultas", "home.html"));
  montarNavPaciente("consultas");
  const raiz = $("#conteudo");
  raiz.replaceChildren(h("p", { class: "pac-vazio", role: "status" }, "Carregando consultas..."));
  await carregar();
}

async function carregar() {
  const raiz = $("#conteudo");
  try {
    const [lista, catalogo] = await Promise.all([agendamentoService.listar(), carregarCatalogo({ incluirInativos: true })]);
    cat = catalogo;
    todas = lista.filter((a) => a.idPaciente === eu.idPaciente);
    definirSelo("consultas", contarConsultasEmAberto(lista, Number(eu.idPaciente), hojeISO(), agoraHHMM()));
    desenhar();
  } catch (err) {
    raiz.replaceChildren(avisoDeErro(err.message));
  }
}

function desenhar() {
  const grupos = separar(todas);
  const raiz = $("#conteudo");

  const abas = h(
    "div",
    { class: "pac-abas", role: "tablist", "aria-label": "Situação das consultas" },
    ABAS.map(({ chave, rotulo }) =>
      h(
        "button",
        {
          type: "button",
          role: "tab",
          id: `aba-${chave}`,
          class: "pac-aba",
          "aria-selected": String(chave === abaAtual),
          "aria-controls": "painel-consultas",
          onclick: () => ((abaAtual = chave), desenhar(), $(`#aba-${chave}`).focus()),
        },
        rotulo,
      ),
    ),
  );
  const itens = grupos[abaAtual];
  const painel = h(
    "div",
    { class: "pac-cons__lista", id: "painel-consultas", role: "tabpanel", "aria-labelledby": `aba-${abaAtual}` },
    itens.length
      ? itens.map(cartao)
      : [
          h("p", { class: "pac-vazio" }, VAZIO[abaAtual]),
          abaAtual === "proximas" ? h("a", { class: "pac-btn pac-cons__novo", href: "agendamento.html" }, "Agendar atendimento") : null,
        ].filter(Boolean),
  );
  raiz.replaceChildren(abas, painel);
}

function linha(icone, texto) {
  return h("li", {}, iconePac(icone), h("span", {}, texto));
}

function cartao(a) {
  const vinculo = cat.vinculoPorId.get(a.idVinculo);
  const clinica = cat.clinicaPorId.get(vinculo?.idClinica);
  const prof = cat.profissionalPorId.get(vinculo?.idProfissional);
  const esp = a.especialidadeNome || cat.especialidadePorId.get(a.idEspecialidade)?.nome || "Consulta";
  const emAberto = ["PENDENTE", "CONFIRMADO"].includes(a.status);
  const passou = quando(a) < `${hojeISO()} ${agoraHHMM()}`;
  const rotulo = emAberto && passou ? "Encerrada" : (ROTULO_STATUS[a.status] ?? a.status);
  const status = emAberto && passou ? "ENCERRADO" : a.status;
  const endereco = [clinica?.ruaNumero || clinica?.endereco, clinica?.cidadeUf].filter(Boolean).join(" — ");

  return h(
    "article",
    { class: "pac-consulta" },
    h(
      "div",
      { class: "pac-consulta__topo" },
      h("h2", { class: "pac-consulta__clinica" }, clinica?.nome ?? "Clínica"),
      h("span", { class: "pac-pilula", "data-status": status }, rotulo),
    ),
    h(
      "ul",
      { class: "pac-consulta__dados" },
      prof ? linha("cons-prof", prof.nome) : null,
      linha("cons-esp", esp),
      linha("cons-data", dataCurta(a.data)),
      linha("cons-hora", a.hora),
      endereco ? linha("cons-local", endereco) : null,
    ),
    a.observacao ? h("p", { class: "pac-consulta__obs" }, `Obs.: ${a.observacao}`) : null,
    emAberto && !passou ? botaoCancelar(a) : null,
  );
}

function botaoCancelar(a) {
  const b = h("button", { class: "pac-btn pac-btn--perigo-contorno pac-consulta__cancelar", type: "button" }, "Cancelar consulta");
  b.addEventListener("click", async () => {
    if (!(await confirmarPac("Deseja cancelar esta consulta?", "Cancelar consulta"))) return;
    try {
      await comBotaoOcupado(b, "Cancelando...", () => agendamentoService.alterarStatus(a.id, "CANCELADO"));
      toast("Consulta cancelada.", "sucesso");
      await carregar();
    } catch (err) {
      toast(err.message, "erro");
    }
  });
  return b;
}

const sessao = exigirLogin([PERFIS.PACIENTE]);
if (sessao) iniciar(sessao);
