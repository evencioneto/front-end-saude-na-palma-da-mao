// Tela inicial do administrador: visão geral do sistema e relatório de desempenho.
import { exigirLogin, PERFIS } from "../core/guard.js";
import { h, $, toast } from "../core/dom.js";
import { hojeISO } from "../core/datetime.js";
import { registrarPwa } from "../pwa.js";
import { calcularIndicadores, carregarDadosAdmin, periodos, relatorioCsv } from "../services/adminService.js";
import { montarNavAdm, icone, avisoAdm } from "../ui/admin.js";

const pluralMedicos = (n) => `${n} ${n === 1 ? "médico" : "médicos"}`;

function tile(icon, valor, rotulo, href) {
  const conteudo = [
    h("span", { class: "adm-tile__icone" }, icone(icon)),
    h("p", { class: "adm-tile__valor", "data-valor": "" }, "—"),
    h("p", { class: "adm-tile__rotulo" }, rotulo),
  ];
  return h(href ? "a" : "div", { class: "adm-tile", href: href ?? false }, conteudo);
}

const painel = (titulo, sub, ...filhos) =>
  h("section", { class: "adm-painel" }, h("h2", { class: "adm-painel__titulo" }, titulo), sub ? h("p", { class: "adm-painel__sub" }, sub) : null, ...filhos);

function iniciar() {
  registrarPwa();
  const hoje = hojeISO();
  let dados = null;
  let tipo = "mensal";
  let indice = 0;
  let ultimo = null; // { ind, periodo }

  // ----- esqueleto -----
  const tiles = [
    tile("tile-clinicas", 0, "Clínicas cadastradas", "adm-clinicas.html"),
    tile("tile-profissionais", 0, "Profissionais", "adm-profissionais.html"),
    tile("tile-especialidades", 0, "Especialidades", "adm-especialidades.html"),
    tile("tile-pacientes", 0, "Pacientes", "adm-pacientes.html"),
    tile("tile-agendamentos", 0, "Agendamentos hoje", "adm-agendamentos.html"),
    tile("tile-cancelamentos", 0, "Cancelamentos", "adm-cancelamentos.html"),
  ];

  const botoesTipo = ["semanal", "mensal"].map((t) =>
    h("button", { type: "button", "aria-pressed": String(t === tipo), "data-tipo": t }, t === "semanal" ? "Semanal" : "Mensal"),
  );
  const rotuloSelect = h("label", { for: "ref" }, "Mês de referência");
  const select = h("select", { id: "ref" });
  const relatorio = h("div", { "aria-live": "polite" }, h("p", { class: "adm-carregando" }, "Carregando indicadores..."));
  const baixar = h("button", { class: "adm-baixar", type: "button", disabled: true }, icone("baixar"), "Baixar relatório");
  const aviso = h("div", { role: "alert" });

  $("#conteudo").replaceChildren(
    h(
      "main",
      { class: "adm-home" },
      h("h1", { class: "adm-home__titulo" }, "Administração"),
      h("p", { class: "adm-home__sub" }, "Visão geral do sistema"),
      aviso,
      h("div", { class: "adm-tiles" }, tiles),
      h("h2", { class: "adm-secao" }, "Relatório de desempenho"),
      h("p", { class: "adm-home__sub" }, "Dados consolidados da plataforma."),
      h("div", { class: "adm-segmento", role: "group", "aria-label": "Tipo de relatório" }, botoesTipo),
      h("div", { class: "adm-select" }, rotuloSelect, h("div", { class: "adm-select__caixa" }, select, icone("seta-baixo"))),
      relatorio,
      h("p", { class: "adm-csv-nota" }, "Todos os indicadores acima serão incluídos no arquivo CSV."),
      baixar,
    ),
  );
  montarNavAdm("inicio");

  const preencherSelect = () => {
    rotuloSelect.textContent = tipo === "mensal" ? "Mês de referência" : "Semana de referência";
    select.replaceChildren(...periodos(tipo).map((p, i) => h("option", { value: String(i) }, p.rotulo)));
    select.value = String(indice);
  };

  // ----- desenho do relatório -----
  const barra = (rotulo, n, total, classe) =>
    h(
      "div",
      { class: "adm-barra-linha" },
      h("div", { class: "adm-barra-linha__topo" }, h("span", {}, rotulo), h("strong", {}, String(n))),
      h("div", { class: "adm-barra-trilho" }, h("i", { class: classe, style: `width:${total ? Math.round((n / total) * 100) : 0}%` })),
    );

  const rank = (itens, comCruz) =>
    h(
      "ol",
      { class: "adm-rank" },
      itens.length
        ? itens.map((x, i) =>
            h(
              "li",
              {},
              h("span", { class: `adm-rank__marca${comCruz ? " adm-rank__marca--cruz" : ""}` }, comCruz ? icone("cruz-lista") : String(i + 1)),
              h("span", { class: "adm-rank__nome" }, x.nome),
              h("span", { class: "adm-rank__n" }, String(x.n)),
            ),
          )
        : [h("li", {}, h("span", { class: "adm-rank__nome" }, "Sem agendamentos no período."))],
    );

  const metrica = (rotulo, valor, nota, classe = "") =>
    h("div", { class: "adm-metrica" }, h("p", { class: "adm-metrica__rotulo" }, rotulo), h("p", { class: `adm-metrica__valor ${classe}` }, valor), h("p", { class: "adm-metrica__nota" }, nota));

  const desenhar = () => {
    const periodo = periodos(tipo)[indice];
    const ind = calcularIndicadores(dados, periodo, hoje);
    ultimo = { ind, periodo };
    const p = ind.periodo;

    const valores = [ind.topo.clinicas, ind.topo.profissionais, ind.topo.especialidades, ind.topo.pacientes, ind.topo.agendamentosHoje, ind.topo.cancelamentos];
    tiles.forEach((t, i) => (t.querySelector("[data-valor]").textContent = String(valores[i])));

    relatorio.replaceChildren(
      h(
        "section",
        { class: "adm-painel" },
        h(
          "div",
          { class: "adm-periodo" },
          h("div", {}, h("p", { class: "adm-periodo__rotulo" }, "Período selecionado"), h("p", { class: "adm-periodo__valor" }, periodo.descricao)),
          h("span", { class: "adm-periodo__icone" }, icone("calendario")),
        ),
        h(
          "div",
          { class: "adm-volume" },
          h("div", { class: "adm-volume__topo" }, h("span", { class: "adm-volume__icone" }, icone("relatorio")), h("p", { class: "adm-volume__titulo" }, "Volume Total de Agendamentos")),
          h("p", { class: "adm-volume__valor" }, String(p.total)),
          h("p", { class: "adm-volume__rotulo" }, "agendamentos no período"),
        ),
      ),
      h(
        "div",
        { class: "adm-metricas" },
        metrica("Taxa de conclusão", p.taxaConclusao === null ? "—" : `${p.taxaConclusao}%`, `${p.concluidos} concluídos`, "adm-metrica__valor--ok"),
        metrica("Taxa de cancelamento", p.taxaCancelamento === null ? "—" : `${p.taxaCancelamento}%`, `${p.cancelados} cancelados`, "adm-metrica__valor--ruim"),
        metrica("Crescimento da base", p.crescimento === null ? "—" : `${p.crescimento > 0 ? "+" : ""}${p.crescimento}%`, `${p.novosPacientes} novos pacientes`),
        metrica("Ocupação da agenda", p.ocupacao === null ? "—" : `${p.ocupacao}%`, "dos horários disponíveis"),
      ),
      painel(
        "Status dos agendamentos",
        "",
        h("div", { class: "adm-barras" }, barra("Concluídos", p.concluidos, p.total, "concluido"), barra("Pendentes", p.pendentes, p.total, "pendente"), barra("Cancelados", p.cancelados, p.total, "cancelado")),
      ),
      painel("Especialidades mais buscadas", "", rank(p.topEspecialidades, false)),
      painel("Clínicas mais ativas", "", rank(p.topClinicas, true)),
      painel(
        "Status dos médicos",
        "",
        h(
          "div",
          { class: "adm-medicos" },
          h("div", { class: "adm-medico adm-medico--ok" }, h("strong", {}, String(ind.medicos.ativos)), h("span", {}, "Ativos")),
          h("div", { class: "adm-medico adm-medico--ruim" }, h("strong", {}, String(ind.medicos.inativos)), h("span", {}, "Inativos")),
          h("div", { class: "adm-medico adm-medico--aviso" }, h("strong", {}, String(ind.medicos.indisponiveis)), h("span", {}, "Indisponíveis")),
        ),
      ),
      painel(
        "Perfil dos pacientes",
        "",
        h(
          "ul",
          { class: "adm-dados" },
          h("li", {}, h("span", {}, "Faixa etária predominante"), h("strong", {}, ind.pacientes.faixa ?? "Sem dados")),
          h("li", {}, h("span", {}, "Dados demográficos"), h("strong", {}, ind.pacientes.demografia ?? "Sem dados")),
          h("li", {}, h("span", {}, "Retorno à plataforma"), h("strong", {}, ind.pacientes.retorno ?? "Sem dados")),
        ),
      ),
      painel(
        "Especialidades cadastradas",
        "Especialidades ativas e médicos vinculados",
        h(
          "ul",
          { class: "adm-esps" },
          ind.especialidades.length
            ? ind.especialidades.map((e) => h("li", {}, h("div", {}, h("strong", {}, e.nome), h("em", {}, "Ativa")), h("span", {}, pluralMedicos(e.medicos))))
            : [h("li", {}, h("strong", {}, "Nenhuma especialidade ativa."))],
        ),
      ),
      painel(
        "Log de atividades",
        "Novos cadastros realizados no período",
        h(
          "ul",
          { class: "adm-log" },
          ind.log.length
            ? ind.log.map((l) => h("li", {}, h("time", {}, l.data), h("div", {}, h("span", {}, l.rotulo), h("strong", {}, l.nome))))
            : [h("li", {}, h("span", {}, "Nenhum cadastro no período."))],
        ),
      ),
    );
    baixar.disabled = false;
  };

  // ----- eventos -----
  for (const b of botoesTipo) {
    b.addEventListener("click", () => {
      tipo = b.dataset.tipo;
      indice = 0;
      botoesTipo.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      preencherSelect();
      if (dados) desenhar();
    });
  }
  select.addEventListener("change", () => {
    indice = Number(select.value);
    if (dados) desenhar();
  });
  baixar.addEventListener("click", () => {
    if (!ultimo) return;
    const blob = new Blob([relatorioCsv(ultimo.ind, ultimo.periodo)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = h("a", { href: url, download: `relatorio-triaorto-${ultimo.periodo.inicio}.csv` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Relatório baixado.", "sucesso");
  });

  preencherSelect();
  carregarDadosAdmin()
    .then((d) => {
      dados = d;
      desenhar();
    })
    .catch((erro) => {
      relatorio.replaceChildren();
      aviso.replaceChildren(avisoAdm(`Não foi possível carregar os indicadores. ${erro.message}`));
    });
}

const sessao = exigirLogin([PERFIS.ADMIN]);
if (sessao) iniciar();
