// Minhas consultas (paciente): abas Próximas, Concluídas e Canceladas, com a opção de cancelar uma consulta futura.
import { exigirLogin, PERFIS } from "../core/guard.js";
import { h, $, toast, comBotaoOcupado } from "../core/dom.js";
import { avisoDeErro } from "../ui/layout.js";
import { barraPac, iconePac } from "../ui/fluxoPaciente.js";
import { montarNavPaciente, definirSelo } from "../ui/navPaciente.js";
import { confirmarCancelamento } from "../ui/dialogoPaciente.js";
import { carregarCatalogo } from "../ui/catalogo.js";
import { agendamentoService, contarConsultasEmAberto } from "../services/agendamentoService.js";
import { dataCurta, hojeISO, agoraHHMM } from "../core/datetime.js";
import { registrarPwa } from "../pwa.js";

const ABAS = [
  { chave: "proximas", rotulo: "Próximas" },
  { chave: "concluidas", rotulo: "Concluídas" },
  { chave: "canceladas", rotulo: "Canceladas" },
];
const ROTULO_STATUS = { PENDENTE: "Próxima", CONFIRMADO: "Próxima", CONCLUIDO: "Concluída", CANCELADO: "Cancelada" };
const HORAS_PARA_CANCELAR = 24;

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
          h("div", { class: "pac-cons__vazio" }, iconePac("busca-vazia", 56), h("p", {}, "Nenhuma consulta encontrada.")),
        ],
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
  const status = emAberto && passou ? "ENCERRADO" : emAberto ? "PROXIMA" : a.status;
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
    emAberto && !passou ? h("div", { class: "pac-consulta__acoes" }, botaoCancelar(a)) : null,
  );
}

// Falta pelo menos 24 h para a consulta? (data e hora locais, como o resto da tela)
function podeCancelar(a) {
  const [ano, mes, dia] = a.data.split("-").map(Number);
  const [hh, mm] = a.hora.split(":").map(Number);
  return new Date(ano, mes - 1, dia, hh, mm).getTime() - Date.now() >= HORAS_PARA_CANCELAR * 3600 * 1000;
}

function botaoCancelar(a) {
  const b = h("button", { class: "pac-btn pac-btn--perigo", type: "button" }, "Cancelar consulta");
  b.addEventListener("click", async () => {
    if (!(await confirmarCancelamento())) return;
    if (!podeCancelar(a)) {
      toast(`O cancelamento só é possível com ${HORAS_PARA_CANCELAR} horas de antecedência.`, "erro");
      return;
    }
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
