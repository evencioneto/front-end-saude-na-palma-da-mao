// Agendamento (Figma, 6 passos): especialidade -> local -> profissional -> data -> horário -> confirmar -> "Consulta marcada!".
// Regras de negócio calculadas aqui porque a API não filtra nem valida conflitos.
import { exigirLogin, PERFIS } from "../core/guard.js";
import { h, $, toast, comBotaoOcupado } from "../core/dom.js";
import { avisoDeErro } from "../ui/layout.js";
import { barraPac, passosPac, buscaPac, rodapePac, iconePac } from "../ui/fluxoPaciente.js";
import { normalizar, iniciais } from "../ui/fluxo.js";
import { carregarCatalogo } from "../ui/catalogo.js";
import { disponibilidadeService } from "../services/disponibilidadeService.js";
import { agendamentoService } from "../services/agendamentoService.js";
import { formatarData, dataCurta, gerarHorarios, hojeISO, agoraHHMM } from "../core/datetime.js";
import { iconeEspecialidade } from "../ui/iconesEspecialidade.js";
import { registrarPwa } from "../pwa.js";

const ORDEM = ["idEspecialidade", "idClinica", "idVinculo", "data", "hora"];
const vazio = (texto) => h("p", { class: "pac-vazio" }, texto);

let eu, cat, disponibilidades, agendamentos;
const estado = { passo: 0, idEspecialidade: null, idClinica: null, idVinculo: null, data: null, hora: null, mes: null, filtroClinica: null };
const busca = { texto: "" };

async function iniciar(s) {
  eu = s;
  registrarPwa();
  const raiz = $("#conteudo");
  $("#barra").replaceChildren(barraPac("Agendamento", voltar));
  raiz.replaceChildren(h("p", { class: "pac-vazio", role: "status" }, "Carregando especialidades e horários..."));

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
// Todos os horários do dia para o vínculo, marcando os que já não estão livres (ocupados ou que já passaram).
function horariosDoDia(idVinculo, data) {
  const janelas = disponibilidades.filter(
    (d) => d.idVinculo === idVinculo && d.data === data && d.status === "DISPONIVEL",
  );
  const ocupados = new Set(
    agendamentos
      .filter((a) => a.idVinculo === idVinculo && a.data === data && a.status !== "CANCELADO")
      .map((a) => a.hora),
  );
  const todos = new Set(janelas.flatMap((j) => gerarHorarios(j)));
  const passou = (hh) => data === hojeISO() && hh <= agoraHHMM();
  return [...todos].sort().map((hora) => ({ hora, livre: !ocupados.has(hora) && !passou(hora) }));
}

function horariosLivres(idVinculo, data) {
  return horariosDoDia(idVinculo, data).filter((x) => x.livre).map((x) => x.hora);
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
  if (estado.passo === 5) confirmar();
  else if (ORDEM.slice(0, estado.passo + 1).every((c) => estado[c] !== null)) irPara(estado.passo + 1);
}

// ---------- Renderização ----------
let rodape = null;

function atualizarRodape() {
  if (!rodape) return;
  rodape.continuar.disabled = estado.passo < 5 && estado[ORDEM[estado.passo]] === null;
}

function render() {
  const raiz = $("#conteudo");
  const montadores = [passoEspecialidade, passoLocal, passoProfissional, passoData, passoHorario, passoConfirmar];
  const { titulo, sub, corpo } = montadores[estado.passo]();

  raiz.replaceChildren(
    passosPac(estado.passo),
    h("h1", { class: "pac-h1 pac-intro", tabindex: "-1" }, titulo),
    h("p", { class: "pac-sub" }, sub),
    ...corpo,
  );

  rodape = rodapePac({
    aoVoltar: voltar,
    aoContinuar: avancar,
    rotulo: estado.passo === 5 ? "Confirmar agendamento" : "Continuar",
    habilitado: estado.passo === 5 || estado[ORDEM[estado.passo]] !== null,
    embutido: estado.passo >= 4, // nos dois últimos passos os botões seguem o conteúdo, sem barra fixa
  });
  $("#pagina").classList.toggle("pac-pag--rodape", estado.passo < 4);
  $("#rodape").replaceChildren(rodape.el);
}

// Lista filtrável: re-desenha só a lista para não perder o foco do campo de busca.
function listaFiltravel(itens, textoDe, desenhar, textoVazio, rotulo) {
  const caixa = h("div", { class: "pac-lista", role: "radiogroup", "aria-label": rotulo });
  const desenharLista = () => {
    const termo = normalizar(busca.texto);
    const filtrados = termo ? itens.filter((i) => normalizar(textoDe(i)).includes(termo)) : itens;
    caixa.replaceChildren(...(filtrados.length ? desenhar(filtrados, caixa) : [vazio(textoVazio)]));
  };
  desenharLista();
  return { caixa, filtrar: desenharLista };
}

// Atualiza aria-checked sem redesenhar (mantém foco e rolagem).
function marcar(caixa, id) {
  caixa.querySelectorAll("[role=radio]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.valor === String(id))));
}

function opcao({ classe, valor, selecionado, rotulo, aoEscolher }, ...filhos) {
  return h(
    "button",
    { type: "button", role: "radio", class: `pac-opcao ${classe}`, "data-valor": String(valor), "aria-checked": String(selecionado), "aria-label": rotulo, onclick: aoEscolher },
    ...filhos,
  );
}

function passoEspecialidade() {
  const itens = especialidadesDisponiveis();
  const dica = h("p", { class: "pac-dica", "aria-live": "polite", hidden: estado.idEspecialidade === null }, "1 especialidade selecionada. Você já pode continuar.");
  const { caixa, filtrar } = listaFiltravel(
    itens,
    (e) => `${e.nome} ${e.descricao}`,
    (lista, cx) =>
      lista.map((e) =>
        opcao(
          {
            classe: "pac-esp",
            valor: e.id,
            selecionado: e.id === estado.idEspecialidade,
            rotulo: e.nome,
            aoEscolher: () => (escolher("idEspecialidade", e.id, { avancar: false }), marcar(cx, e.id), (dica.hidden = false)),
          },
          h("span", { class: "pac-esp__icone" }, iconePac(iconeEspecialidade(e.nome))),
          h("span", { class: "pac-esp__selo" }, iconePac("selecionada"), "Selecionada"),
          h("span", { class: "pac-esp__nome" }, e.nome),
          e.descricao ? h("span", { class: "pac-esp__desc" }, e.descricao) : null,
        ),
      ),
    itens.length === 0 ? "Nenhuma especialidade com profissional disponível no momento." : "Nenhuma especialidade encontrada.",
    "Especialidades",
  );
  return {
    titulo: "Qual atendimento você procura?",
    sub: "Escolha a especialidade que melhor atende às suas necessidades.",
    corpo: [buscaPac("Buscar especialidade...", (t) => ((busca.texto = t), filtrar())), h("p", { class: "pac-lista-titulo" }, "Especialidades ortopédicas"), caixa, dica],
  };
}

function passoLocal() {
  const itens = clinicasDaEspecialidade(estado.idEspecialidade);
  const { caixa, filtrar } = listaFiltravel(
    itens,
    (c) => `${c.nome} ${c.endereco}`,
    (lista, cx) =>
      lista.map((c, i) =>
        opcao(
          {
            classe: "pac-local",
            valor: c.id,
            selecionado: c.id === estado.idClinica,
            rotulo: c.nome,
            aoEscolher: () => (escolher("idClinica", c.id, { avancar: false }), marcar(cx, c.id)),
          },
          h("span", { class: "pac-radio", "aria-hidden": "true" }),
          h("span", { class: "pac-sigla", "data-cor": String(corDoItem(c.id)), "aria-hidden": "true" }, sigla(c.nome)),
          h(
            "span",
            { class: "pac-local__texto" },
            h("span", { class: "pac-local__nome" }, c.nome),
            h("span", { class: "pac-local__linha" }, c.ruaNumero || c.endereco),
            c.cidadeUf && c.ruaNumero ? h("span", { class: "pac-local__linha" }, c.cidadeUf) : null,
          ),
        ),
      ),
    "Nenhuma unidade encontrada.",
    "Unidades",
  );
  return {
    titulo: "Escolha o local do atendimento",
    sub: `Selecione a unidade mais próxima de você. Especialidades: ${cat.especialidadePorId.get(estado.idEspecialidade)?.nome ?? ""}.`,
    corpo: [buscaPac("Buscar unidade...", (t) => ((busca.texto = t), filtrar())), caixa],
  };
}

// Cor estável por item (a mesma unidade ou profissional tem sempre a mesma cor).
const corDoItem = (id) => Math.abs((Number(id) || 1) - 1) % 5;

// Sigla de duas letras: iniciais das duas primeiras palavras que importam ("Hospital de Ortopedia" -> "HO").
function sigla(nome) {
  const palavras = String(nome ?? "").split(/\s+/).filter((p) => p && !/^(d[aeo]s?|e)$/i.test(p));
  if (palavras.length >= 2) return (palavras[0][0] + palavras[1][0]).toUpperCase();
  return String(nome ?? "").slice(0, 2).toUpperCase();
}

function passoProfissional() {
  const itens = profissionaisDaClinica(estado.idEspecialidade, estado.idClinica);
  const esp = cat.especialidadePorId.get(estado.idEspecialidade);
  const { caixa, filtrar } = listaFiltravel(
    itens,
    ({ prof }) => prof.nome,
    (lista, cx) =>
      lista.map(({ vinculo, prof }) =>
        opcao(
          {
            classe: "pac-prof",
            valor: vinculo.id,
            selecionado: vinculo.id === estado.idVinculo,
            rotulo: prof.nome,
            aoEscolher: () => (escolher("idVinculo", vinculo.id, { avancar: false }), marcar(cx, vinculo.id)),
          },
          h("span", { class: "pac-avatar-prof", "data-cor": String(corDoItem(prof.id ?? vinculo.idProfissional)), "aria-hidden": "true" }, iniciais(prof.nome)),
          h(
            "span",
            { class: "pac-prof__texto" },
            h("span", { class: "pac-prof__nome" }, prof.nome),
            h("span", { class: "pac-prof__esp" }, esp?.nome ?? ""),
            h("span", { class: "pac-prof__reg" }, [[prof.conselho, prof.registro].filter(Boolean).join(" "), prof.uf].filter(Boolean).join("-")),
          ),
          h("span", { class: "pac-radio", "aria-hidden": "true" }),
        ),
      ),
    "Nenhum profissional encontrado.",
    "Profissionais",
  );
  return {
    titulo: "Escolha o profissional",
    sub: "Selecione o profissional que irá realizar seu atendimento.",
    corpo: [buscaPac("Buscar profissional...", (t) => ((busca.texto = t), filtrar())), caixa],
  };
}

// ---------- calendário ----------
function passoData() {
  const datas = datasDisponiveis(estado.idVinculo);
  const corpo = [];
  const titulo = "Escolha a data";
  const sub = "Selecione um dia disponível para o atendimento.";
  if (datas.length === 0) {
    corpo.push(vazio("Este profissional não tem horários livres no momento. Volte e escolha outro profissional."));
    return { titulo, sub, corpo };
  }

  const livres = new Set(datas);
  const [ya, ma] = datas[0].split("-").map(Number);
  const [yz, mz] = datas.at(-1).split("-").map(Number);
  if (!estado.mes) {
    const [y, m] = (estado.data ?? datas[0]).split("-").map(Number);
    estado.mes = { ano: y, mes: m };
  }
  const indice = (a, m) => a * 12 + (m - 1);

  const topo = h("div", { class: "pac-cal__topo" });
  const grade = h("div", { class: "pac-cal__grade", role: "group", "aria-label": "Dias do mês" });
  const aviso = h("p", { class: "pac-sr", "aria-live": "polite" });
  const legenda = h(
    "ul",
    { class: "pac-cal__leg" },
    h("li", {}, h("i", { class: "l-disp" }), "Disponível"),
    h("li", {}, h("i", { class: "l-nao" }), "Não disponível"),
    h("li", {}, h("i", { class: "l-sel" }), "Selecionado"),
  );
  const cartao = h("div", { class: "pac-cal" }, topo, grade, legenda);

  function desenhar() {
    const { ano, mes } = estado.mes;
    const atual = indice(ano, mes);
    const nome = new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); // "outubro de 2026" (o CSS põe em maiúsculas)
    const ant = h("button", { type: "button", class: "pac-cal__nav", "aria-label": "Mês anterior", disabled: atual <= indice(ya, ma),
      onclick: () => ((estado.mes = mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 }), desenhar()) }, iconePac("cal-ant"));
    const prox = h("button", { type: "button", class: "pac-cal__nav", "aria-label": "Próximo mês", disabled: atual >= indice(yz, mz),
      onclick: () => ((estado.mes = mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 }), desenhar()) }, iconePac("cal-prox"));
    topo.replaceChildren(ant, h("p", { class: "pac-cal__mes", "aria-live": "polite" }, nome), prox);

    const primeiro = new Date(ano, mes - 1, 1).getDay();
    const total = new Date(ano, mes, 0).getDate();
    const celulas = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => h("span", { class: "pac-cal__sem", "aria-hidden": "true" }, d));
    for (let i = 0; i < primeiro; i++) celulas.push(h("span"));
    for (let d = 1; d <= total; d++) {
      const iso = `${ano}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const livre = livres.has(iso);
      celulas.push(
        h(
          "button",
          {
            type: "button",
            class: "pac-cal__dia",
            disabled: !livre,
            "data-data": iso,
            "aria-pressed": livre ? String(estado.data === iso) : false,
            "aria-label": livre ? formatarData(iso) : `${formatarData(iso)}, sem horários`,
            onclick: () => {
              escolher("data", iso, { avancar: false });
              grade.querySelectorAll("[data-data]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.data === iso)));
              aviso.textContent = `Data escolhida: ${formatarData(iso)}`;
            },
          },
          String(d),
        ),
      );
    }
    grade.replaceChildren(...celulas);
  }
  desenhar();

  return { titulo, sub, corpo: [cartao, aviso] };
}

function passoHorario() {
  const dia = horariosDoDia(estado.idVinculo, estado.data);
  const corpo = [];
  if (!dia.some((x) => x.livre)) {
    corpo.push(vazio("Não há mais horários livres neste dia. Volte e escolha outra data."));
  } else {
    const grade = h(
      "div",
      { class: "pac-horarios", role: "radiogroup", "aria-label": `Horários em ${formatarData(estado.data)}` },
      dia.map(({ hora, livre }) =>
        h("button", {
          type: "button", role: "radio", class: "pac-horario", "data-hora": hora, "aria-checked": String(hora === estado.hora), disabled: !livre,
          "aria-label": livre ? hora : `${hora}, indisponível`,
          onclick: () => {
            escolher("hora", hora, { avancar: false });
            grade.querySelectorAll("[data-hora]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.hora === hora)));
          },
        }, hora),
      ),
    );
    corpo.push(grade, h("p", { class: "pac-horarios__nota" }, "Horários riscados não estão disponíveis."));
  }
  return { titulo: "Escolha o horário", sub: "Selecione um horário disponível para o atendimento.", corpo };
}

// Passo 6: resumo para conferir antes de gravar.
function dadosDoResumo() {
  const clinica = cat.clinicaPorId.get(estado.idClinica);
  const esp = cat.especialidadePorId.get(estado.idEspecialidade);
  const vinc = cat.vinculoPorId.get(estado.idVinculo);
  const prof = cat.profissionalPorId.get(vinc?.idProfissional);
  return { clinica, esp, prof };
}

function passoConfirmar() {
  const { clinica, esp, prof } = dadosDoResumo();
  const endereco = [clinica?.ruaNumero, clinica?.cidadeUf].filter(Boolean).join(", ");
  const linhas = [
    ["Especialidade", esp?.nome],
    ["Clínica", clinica?.nome],
    ["Profissional", prof?.nome],
    ["Data", dataCurta(estado.data)],
    ["Horário", estado.hora],
    ["Endereço", endereco],
  ].filter(([, v]) => v);
  return {
    titulo: "Confirmar agendamento",
    sub: "Revise os dados antes de confirmar.",
    corpo: [
      h(
        "dl",
        { class: "pac-resumo" },
        linhas.map(([rotulo, valor]) => h("div", { class: "pac-resumo__linha" }, h("dt", {}, rotulo), h("dd", {}, valor))),
      ),
    ],
  };
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
      }),
    );
    mostrarPronto();
  } catch (err) {
    if (err.status === 409) {
      // Alguém pegou o horário antes: atualiza a lista e volta para a escolha do horário.
      agendamentos = await agendamentoService.listar().catch(() => agendamentos);
      estado.hora = null;
      estado.passo = 4;
      render();
      toast(err.message, "erro");
    } else {
      toast(err.message, "erro");
    }
  }
}

function mostrarPronto() {
  const { clinica, prof } = dadosDoResumo();
  const linhas = [["Profissional", prof?.nome], ["Data", dataCurta(estado.data)], ["Horário", estado.hora], ["Local", clinica?.nome]].filter(([, v]) => v);

  $("#barra").replaceChildren();
  $("#rodape").replaceChildren();
  $("#pagina").classList.remove("pac-pag--rodape");
  const raiz = $("#conteudo");
  raiz.className = "pac-pronto";
  raiz.replaceChildren(
    iconePac("ok-grande", 80),
    h("h1", { class: "pac-h1", tabindex: "-1" }, "Consulta marcada!"),
    h("p", { class: "pac-pronto__texto" }, "Seu agendamento foi confirmado com sucesso."),
    h(
      "dl",
      { class: "pac-pronto__card", "aria-label": "Resumo do agendamento" },
      linhas.map(([rotulo, valor]) => h("div", { class: "pac-pronto__linha" }, h("dt", {}, rotulo), h("dd", {}, valor))),
    ),
    h("p", { class: "pac-pronto__texto pac-pronto__nota" }, "Você pode cancelar esta consulta até 24h antes do horário agendado."),
    h(
      "div",
      { class: "pac-pronto__acoes" },
      h("a", { class: "pac-btn", href: "agendamentos.html" }, "Ver minhas consultas"),
      h("a", { class: "pac-btn pac-btn--texto", href: "home.html" }, "Voltar ao início"),
    ),
  );
  window.scrollTo(0, 0);
  raiz.querySelector("h1").focus({ preventScroll: true });
}

// Inicia só depois de todas as declarações do módulo (evita acessar let/const antes da inicialização).
const sessao = exigirLogin([PERFIS.PACIENTE, PERFIS.ADMIN]);
if (sessao) iniciar(sessao);
