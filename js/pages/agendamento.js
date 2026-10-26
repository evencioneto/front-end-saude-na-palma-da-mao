// Agendamento em 5 passos (Figma): especialidade -> local -> profissional -> data -> horário -> "Pronto!".
// Regras de negócio calculadas aqui porque a API não filtra nem valida conflitos.
import { exigirLogin, PERFIS } from "../core/guard.js";
import { h, $, carregando, estadoVazio, toast, comBotaoOcupado } from "../core/dom.js";
import { avisoDeErro } from "../ui/layout.js";
import { barraFluxo, passos, campoBusca, rodapeFluxo, normalizar, iniciais } from "../ui/fluxo.js";
import { montarNavInferior, removerNavInferior } from "../ui/navInferior.js";
import { carregarCatalogo } from "../ui/catalogo.js";
import { disponibilidadeService } from "../services/disponibilidadeService.js";
import { agendamentoService } from "../services/agendamentoService.js";
import { formatarData, formatarDataLonga, gerarHorarios, hojeISO, agoraHHMM } from "../core/datetime.js";
import { registrarPwa } from "../pwa.js";

const ORDEM = ["idEspecialidade", "idClinica", "idVinculo", "data", "hora"];
const ICONE_ESPECIALIDADE = [
  [/preven|recupera|esporte|les[aã]o|lesoes/i, "icons/ui/esp-prevencao.png"],
  [/reabilit|fortalec|fisio/i, "icons/ui/esp-reabilitacao.png"],
  [/ortop/i, "icons/ui/esp-ortopedia.png"],
];
const iconeEspecialidade = (nome) => ICONE_ESPECIALIDADE.find(([r]) => r.test(nome))?.[1] ?? "icons/ui/esp-ortopedia.png";

let eu, cat, disponibilidades, agendamentos;
const estado = { passo: 0, idEspecialidade: null, idClinica: null, idVinculo: null, data: null, hora: null, obs: "", mes: null, filtroClinica: null };
const busca = { texto: "" };

async function iniciar(s) {
  eu = s;
  registrarPwa();
  const raiz = $("#conteudo");
  $("#barra").replaceChildren(barraFluxo("Agendamento", voltar));
  raiz.replaceChildren(carregando("Carregando especialidades e horários..."));

  if (!s.idPaciente) {
    raiz.replaceChildren(avisoDeErro("Não encontramos seu cadastro de paciente. Saia e entre novamente."));
    return;
  }

  try {
    [cat, disponibilidades, agendamentos] = await Promise.all([
      carregarCatalogo(),
      disponibilidadeService.listar(),
      agendamentoService.listar(),
    ]);
  } catch (err) {
    raiz.replaceChildren(avisoDeErro(err.message));
    return;
  }

  // Atalhos vindos de outras telas: ?especialidade=ID (pré-triagem) e ?clinica=ID (lista de clínicas).
  const params = new URLSearchParams(location.search);
  const idClinica = Number(params.get("clinica"));
  if (cat.clinicaPorId.has(idClinica)) estado.filtroClinica = idClinica;
  const idEsp = Number(params.get("especialidade"));
  if (especialidadesDisponiveis().some((e) => e.id === idEsp)) {
    estado.idEspecialidade = idEsp;
    estado.passo = 1;
  }
  render();
}

// ---------- Regras de disponibilidade ----------
function horariosLivres(idVinculo, data) {
  const janelas = disponibilidades.filter(
    (d) => d.idVinculo === idVinculo && d.data === data && d.status === "DISPONIVEL",
  );
  const ocupados = new Set(
    agendamentos
      .filter((a) => a.idVinculo === idVinculo && a.data === data && a.status !== "CANCELADO")
      .map((a) => a.hora),
  );
  const todos = new Set(janelas.flatMap((j) => gerarHorarios(j)));
  let livres = [...todos].filter((hh) => !ocupados.has(hh)).sort();
  if (data === hojeISO()) livres = livres.filter((hh) => hh > agoraHHMM());
  return livres;
}

// Datas futuras com pelo menos um horário livre para o vínculo escolhido.
function datasDisponiveis(idVinculo) {
  const datas = [...new Set(disponibilidades.filter((d) => d.idVinculo === idVinculo).map((d) => d.data))]
    .filter((d) => d >= hojeISO())
    .sort();
  return datas.filter((data) => horariosLivres(idVinculo, data).length > 0);
}

// Vínculos (profissional + clínica) que atendem a especialidade escolhida.
function vinculosDaEspecialidade(idEspecialidade) {
  return cat.vinculos.filter((v) => {
    if (estado.filtroClinica && v.idClinica !== estado.filtroClinica) return false;
    if (!cat.clinicaPorId.has(v.idClinica)) return false;
    const p = cat.profissionalPorId.get(v.idProfissional);
    return (
      p?.ativo &&
      cat.profEsp.some((x) => x.idProfissional === v.idProfissional && x.idEspecialidade === idEspecialidade) &&
      cat.clinEsp.some((x) => x.idClinica === v.idClinica && x.idEspecialidade === idEspecialidade)
    );
  });
}

// Só oferece especialidades que têm ao menos um profissional (evita becos sem saída).
function especialidadesDisponiveis() {
  return cat.especialidades.filter((e) => vinculosDaEspecialidade(e.id).length > 0);
}

function clinicasDaEspecialidade(idEspecialidade) {
  const ids = new Set(vinculosDaEspecialidade(idEspecialidade).map((v) => v.idClinica));
  return cat.clinicas.filter((c) => ids.has(c.id));
}

function profissionaisDaClinica(idEspecialidade, idClinica) {
  return vinculosDaEspecialidade(idEspecialidade)
    .filter((v) => v.idClinica === idClinica)
    .map((v) => ({ vinculo: v, prof: cat.profissionalPorId.get(v.idProfissional) }));
}

// ---------- Navegação ----------
function escolher(campo, valor, { avancar = true } = {}) {
  const i = ORDEM.indexOf(campo);
  ORDEM.slice(i + 1).forEach((c) => (estado[c] = null));
  estado[campo] = valor;
  if (["idEspecialidade", "idClinica", "idVinculo"].includes(campo)) estado.mes = null; // calendário recomeça no 1º mês com vaga
  if (avancar) irPara(i + 1);
  else atualizarRodape();
}

function irPara(passo) {
  estado.passo = passo;
  busca.texto = "";
  render();
  window.scrollTo(0, 0);
}

function voltar() {
  if (estado.passo === 0) location.href = "home.html";
  else irPara(estado.passo - 1);
}

function avancar() {
  if (estado.passo === 4) confirmar();
  else if (ORDEM.slice(0, estado.passo + 1).every((c) => estado[c] !== null)) irPara(estado.passo + 1);
}

// ---------- Renderização ----------
let rodape = null;

function atualizarRodape() {
  if (!rodape) return;
  rodape.continuar.disabled = estado[ORDEM[estado.passo]] === null;
}

function render() {
  const raiz = $("#conteudo");
  const cabecalho = (titulo, sub) => [passos(estado.passo), h("h1", { class: "fluxo__titulo", tabindex: "-1" }, titulo), h("p", { class: "fluxo__sub" }, sub)];

  const montadores = [passoEspecialidade, passoLocal, passoProfissional, passoData, passoHorario];
  const { titulo, sub, corpo } = montadores[estado.passo]();

  raiz.className = "fluxo" + (estado.passo === 0 ? " fluxo--sem-rodape" : "");
  raiz.replaceChildren(...cabecalho(titulo, sub), ...corpo);

  // Barra inferior só no passo 1; os demais usam Voltar/Continuar.
  if (estado.passo === 0) {
    montarNavInferior("inicio");
    $("#rodape").replaceChildren();
    rodape = null;
  } else {
    removerNavInferior();
    rodape = rodapeFluxo({
      aoVoltar: voltar,
      aoContinuar: avancar,
      rotulo: estado.passo === 4 ? "Confirmar" : "Continuar",
      habilitado: estado[ORDEM[estado.passo]] !== null,
    });
    $("#rodape").replaceChildren(rodape.el);
  }
}

// Lista filtrável: re-desenha só a lista para não perder o foco do campo de busca.
function listaFiltravel(itens, textoDe, desenhar, vazio) {
  const caixa = h("div", { class: "lista-filtravel" });
  const desenharLista = () => {
    const termo = normalizar(busca.texto);
    const filtrados = termo ? itens.filter((i) => normalizar(textoDe(i)).includes(termo)) : itens;
    caixa.replaceChildren(...(filtrados.length ? desenhar(filtrados) : [estadoVazio(vazio)]));
  };
  desenharLista();
  return { caixa, filtrar: desenharLista };
}

function passoEspecialidade() {
  const itens = especialidadesDisponiveis();
  const { caixa, filtrar } = listaFiltravel(
    itens,
    (e) => `${e.nome} ${e.descricao}`,
    (lista) => [
      h(
        "div",
        { class: "grade-esp", role: "group", "aria-label": "Especialidades" },
        lista.map((e) =>
          h(
            "button",
            { type: "button", class: "cartao-esp", onclick: () => escolher("idEspecialidade", e.id) },
            h("span", { class: "cartao-esp__icone" }, h("img", { src: iconeEspecialidade(e.nome), alt: "", width: "45", height: "45" })),
            h("strong", {}, e.nome),
            e.descricao ? h("span", {}, e.descricao) : null,
          ),
        ),
      ),
    ],
    itens.length === 0 ? "Nenhuma especialidade com profissional disponível no momento." : "Nenhuma especialidade encontrada.",
  );
  return {
    titulo: "Qual atendimento você procura?",
    sub: "Escolha a especialidade que melhor atende às suas necessidades.",
    corpo: [
      campoBusca("Buscar especialidade...", (t) => ((busca.texto = t), filtrar())),
      h("p", { class: "fluxo__secao" }, "Especialidades ortopédicas"),
      caixa,
    ],
  };
}

function cartaoRadio({ classe = "", selecionado, aoEscolher, rotulo, conteudo }) {
  return h(
    "button",
    { type: "button", role: "radio", class: `opcao-radio ${classe}`.trim(), "aria-checked": String(selecionado), "aria-label": rotulo, onclick: aoEscolher },
    ...conteudo,
  );
}

function passoLocal() {
  const itens = clinicasDaEspecialidade(estado.idEspecialidade);
  const { caixa, filtrar } = listaFiltravel(
    itens,
    (c) => `${c.nome} ${c.endereco}`,
    (lista) => [
      h(
        "div",
        { class: "lista-opcoes", role: "radiogroup", "aria-label": "Unidades" },
        lista.map((c) =>
          cartaoRadio({
            classe: "opcao-radio--destaque",
            selecionado: c.id === estado.idClinica,
            rotulo: c.nome,
            aoEscolher: () => (escolher("idClinica", c.id, { avancar: false }), marcar(caixa, c.id)),
            conteudo: [
              h("span", { class: "opcao-radio__seletor", "aria-hidden": "true" }),
              h("span", { class: "opcao-radio__texto", "data-id": c.id }, h("strong", {}, c.nome), h("span", {}, c.ruaNumero || c.endereco), c.cidadeUf && c.ruaNumero ? h("span", {}, c.cidadeUf) : null),
            ],
          }),
        ),
      ),
    ],
    "Nenhuma unidade encontrada.",
  );
  return {
    titulo: "Escolha o local do atendimento",
    sub: "Selecione a unidade mais próxima de você.",
    corpo: [campoBusca("Buscar unidade...", (t) => ((busca.texto = t), filtrar())), caixa],
  };
}

// Atualiza aria-checked sem redesenhar (mantém foco e rolagem).
function marcar(caixa, id) {
  caixa.querySelectorAll("[role=radio]").forEach((b) => {
    const alvo = b.querySelector("[data-id]")?.dataset.id ?? b.dataset.valor;
    b.setAttribute("aria-checked", String(String(alvo) === String(id)));
  });
}

function passoProfissional() {
  const itens = profissionaisDaClinica(estado.idEspecialidade, estado.idClinica);
  const esp = cat.especialidadePorId.get(estado.idEspecialidade);
  const { caixa, filtrar } = listaFiltravel(
    itens,
    ({ prof }) => prof.nome,
    (lista) => [
      h(
        "div",
        { class: "lista-opcoes", role: "radiogroup", "aria-label": "Profissionais" },
        lista.map(({ vinculo, prof }) =>
          cartaoRadio({
            classe: "opcao-radio--prof",
            selecionado: vinculo.id === estado.idVinculo,
            rotulo: prof.nome,
            aoEscolher: () => (escolher("idVinculo", vinculo.id, { avancar: false }), marcar(caixa, vinculo.id)),
            conteudo: [
              h("span", { class: "opcao-radio__seletor", "aria-hidden": "true" }),
              h(
                "span",
                { class: "opcao-radio__texto", "data-id": vinculo.id },
                h("strong", {}, prof.nome),
                h("span", {}, esp?.nome ?? ""),
                h("span", {}, [prof.conselho, prof.registro].filter(Boolean).join(" ") + (prof.uf ? `/${prof.uf}` : "")),
              ),
              h("span", { class: "opcao-radio__avatar", "aria-hidden": "true" }, iniciais(prof.nome)),
            ],
          }),
        ),
      ),
    ],
    "Nenhum profissional encontrado.",
  );
  return {
    titulo: "Escolha o profissional",
    sub: "Selecione o profissional que irá realizar seu atendimento.",
    corpo: [campoBusca("Buscar profissional...", (t) => ((busca.texto = t), filtrar())), caixa],
  };
}

// ---------- calendário ----------
const SETA = (d) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
const iconeSeta = (d) => {
  const span = h("span");
  span.innerHTML = SETA(d); // conteúdo fixo escrito aqui, nunca vindo da API
  return span.firstChild;
};

function passoData() {
  const datas = datasDisponiveis(estado.idVinculo);
  const corpo = [];
  if (datas.length === 0) {
    corpo.push(estadoVazio("Este profissional não tem horários livres no momento. Volte e escolha outro profissional."));
    return { titulo: "Escolha uma data", sub: "Veja as datas disponíveis para agendar o seu atendimento.", corpo };
  }

  const livres = new Set(datas);
  const [ya, ma] = datas[0].split("-").map(Number);
  const [yz, mz] = datas.at(-1).split("-").map(Number);
  if (!estado.mes) {
    const [y, m] = (estado.data ?? datas[0]).split("-").map(Number);
    estado.mes = { ano: y, mes: m };
  }
  const indice = (a, m) => a * 12 + (m - 1);

  const topo = h("div", { class: "calendario__topo" });
  const grade = h("div", { class: "calendario__grade", role: "group" });
  const legenda = h("p", { class: "calendario__legenda", "aria-live": "polite" });
  const cartao = h("div", { class: "calendario" }, topo, grade);

  function desenhar() {
    const { ano, mes } = estado.mes;
    const atual = indice(ano, mes);
    const mesAno = new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); // "outubro de 2026"
    const nome = mesAno.charAt(0).toUpperCase() + mesAno.slice(1);
    const ant = h("button", { type: "button", class: "calendario__nav", "aria-label": "Mês anterior", disabled: atual <= indice(ya, ma),
      onclick: () => ((estado.mes = mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 }), desenhar()) }, iconeSeta("m15 18-6-6 6-6"));
    const prox = h("button", { type: "button", class: "calendario__nav", "aria-label": "Próximo mês", disabled: atual >= indice(yz, mz),
      onclick: () => ((estado.mes = mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 }), desenhar()) }, iconeSeta("m9 18 6-6-6-6"));
    topo.replaceChildren(ant, h("p", { class: "calendario__mes", "aria-live": "polite" }, nome), prox);

    const primeiro = new Date(ano, mes - 1, 1).getDay();
    const total = new Date(ano, mes, 0).getDate();
    const celulas = ["D", "S", "T", "Q", "Q", "S", "S"].map((d) => h("span", { class: "calendario__semana", "aria-hidden": "true" }, d));
    for (let i = 0; i < primeiro; i++) celulas.push(h("span"));
    for (let d = 1; d <= total; d++) {
      const iso = `${ano}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const livre = livres.has(iso);
      celulas.push(
        h(
          "button",
          {
            type: "button",
            class: "calendario__dia",
            disabled: !livre,
            "data-data": iso,
            "aria-pressed": livre ? String(estado.data === iso) : false,
            "aria-label": livre ? formatarData(iso) : `${formatarData(iso)}, sem horários`,
            onclick: () => {
              escolher("data", iso, { avancar: false });
              grade.querySelectorAll("[data-data]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.data === iso)));
              legenda.textContent = `Data escolhida: ${formatarData(iso)}`;
            },
          },
          String(d),
        ),
      );
    }
    grade.replaceChildren(...celulas);
  }
  desenhar();
  legenda.textContent = estado.data ? `Data escolhida: ${formatarData(estado.data)}` : "Os dias destacados têm horários livres.";

  return {
    titulo: "Escolha uma data",
    sub: "Veja as datas disponíveis para agendar o seu atendimento.",
    corpo: [cartao, legenda],
  };
}

function passoHorario() {
  const livres = horariosLivres(estado.idVinculo, estado.data);
  const corpo = [];
  if (livres.length === 0) {
    corpo.push(estadoVazio("Não há mais horários livres neste dia. Volte e escolha outra data."));
  } else {
    const grade = h(
      "div",
      { class: "grade-horarios", role: "radiogroup", "aria-label": `Horários em ${formatarData(estado.data)}` },
      livres.map((hh) =>
        h("button", {
          type: "button", role: "radio", class: "horario", "data-hora": hh, "aria-checked": String(hh === estado.hora),
          onclick: () => {
            escolher("hora", hh, { avancar: false });
            grade.querySelectorAll("[data-hora]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.hora === hh)));
          },
        }, hh),
      ),
    );
    const obs = h("textarea", { id: "obs", rows: "3", maxlength: "500", placeholder: "Ex.: preciso de acompanhante...", oninput: (e) => (estado.obs = e.target.value) });
    obs.value = estado.obs;
    corpo.push(
      h("p", { class: "fluxo__secao", style: "margin-top:12px" }, "Horários disponíveis"),
      grade,
      h("div", { class: "observacao" }, h("label", { for: "obs" }, "Observação (opcional)"), obs),
    );
  }
  return { titulo: "Escolha um horário", sub: "Selecione o melhor horário para você.", corpo };
}

// ---------- confirmação ----------
async function confirmar() {
  const botao = rodape?.continuar;
  try {
    await comBotaoOcupado(botao, "Agendando...", () =>
      agendamentoService.criar({
        idPaciente: eu.idPaciente,
        idVinculo: estado.idVinculo,
        idEspecialidade: estado.idEspecialidade,
        data: estado.data,
        hora: estado.hora,
        observacao: estado.obs.trim(),
      }),
    );
    mostrarPronto();
  } catch (err) {
    if (err.status === 409) {
      // Alguém pegou o horário antes: atualiza a lista e volta para a escolha do horário.
      agendamentos = await agendamentoService.listar().catch(() => agendamentos);
      estado.hora = null;
      render();
      toast(err.message, "erro");
    } else {
      toast(err.message, "erro");
    }
  }
}

function mostrarPronto() {
  const clinica = cat.clinicaPorId.get(estado.idClinica);
  const esp = cat.especialidadePorId.get(estado.idEspecialidade);
  const vinc = cat.vinculoPorId.get(estado.idVinculo);
  const prof = cat.profissionalPorId.get(vinc?.idProfissional);

  removerNavInferior();
  $("#barra").replaceChildren();
  $("#rodape").replaceChildren();
  const raiz = $("#conteudo");
  raiz.className = "pronto";
  raiz.replaceChildren(
    h("img", { class: "pronto__icone", src: "icons/ui/sucesso.png", alt: "", width: "96", height: "96" }),
    h("h1", { class: "pronto__titulo", tabindex: "-1" }, "Pronto!"),
    h("p", { class: "pronto__texto" }, "Seu atendimento foi agendado."),
    h("p", { class: "pronto__texto", style: "margin-top:2px" }, "Você poderá acessar as informações em “Consultar Agendamentos”."),
    h(
      "section",
      { class: "pronto__card", "aria-label": "Resumo do agendamento" },
      h(
        "div",
        { class: "pronto__card-topo" },
        h("span", { class: "pronto__card-icone" }, h("img", { src: iconeEspecialidade(esp?.nome ?? ""), alt: "", width: "45", height: "45" })),
        h("strong", {}, "Seu atendimento"),
      ),
      h(
        "div",
        { class: "pronto__linhas" },
        h("p", {}, esp?.nome, prof ? h("br") : null, prof?.nome),
        h("p", {}, clinica?.nome, h("br"), clinica?.ruaNumero, clinica?.ruaNumero ? h("br") : null, clinica?.cidadeUf),
        h("p", {}, formatarDataLonga(estado.data)),
        h("p", {}, `${estado.hora}h`),
      ),
    ),
    h(
      "div",
      { class: "pronto__acoes" },
      h("a", { class: "btn btn--bloco", href: "agendamentos.html" }, "Ver meus agendamentos"),
      h("a", { class: "btn btn--contorno btn--bloco", href: "home.html" }, "Voltar para o início"),
    ),
  );
  window.scrollTo(0, 0);
  raiz.querySelector("h1").focus({ preventScroll: true });
}

// Inicia só depois de todas as declarações do módulo (evita acessar let/const antes da inicialização).
const sessao = exigirLogin([PERFIS.PACIENTE, PERFIS.ADMIN]);
if (sessao) iniciar(sessao);
