// "Cancelamentos": histórico de consultas canceladas (somente leitura).
import { exigirLogin, PERFIS } from "../core/guard.js";
import { h, $ } from "../core/dom.js";
import { registrarPwa } from "../pwa.js";
import { hojeISO, formatarDataCurta } from "../core/datetime.js";
import { carregarCatalogo } from "../ui/catalogo.js";
import { agendamentoService } from "../services/agendamentoService.js";
import { resumoCancelamentos } from "../services/adminService.js";
import { cabecalhoLista, montarNavAdm, avisoAdm, vazioAdm } from "../ui/admin.js";

function cartao(a, cat) {
  const v = cat.vinculoPorId.get(a.idVinculo);
  const prof = v && cat.profissionalPorId.get(v.idProfissional);
  const clinica = v && cat.clinicaPorId.get(v.idClinica);
  const esp = cat.especialidadePorId.get(a.idEspecialidade)?.nome || a.especialidadeNome;
  return h(
    "article",
    { class: "adm-cartao" },
    h(
      "div",
      { class: "adm-cartao__linha adm-cartao__linha--topo" },
      h("h2", { class: "adm-cartao__nome" }, prof?.nome ?? "Profissional não encontrado"),
      h("span", { class: "adm-chip-status adm-chip-status--inativo" }, "Cancelado"),
    ),
    esp ? h("p", { class: "adm-ag__esp" }, esp) : null,
    h("p", { class: "adm-cartao__texto" }, clinica?.nome ?? "Clínica não encontrada", h("br"), `${formatarDataCurta(a.data)} às ${a.hora}`),
    // O back-end não tem campo próprio para o motivo: usa a observação do agendamento.
    h("p", { class: "adm-canc__motivo" }, a.observacao ? `Motivo: ${a.observacao}` : "Motivo não informado"),
  );
}

async function iniciar() {
  registrarPwa();
  const conteudo = h("div", { "aria-live": "polite" }, h("p", { class: "adm-vazio" }, "Carregando cancelamentos..."));
  $("#conteudo").replaceChildren(
    h("main", { class: "adm-lista" }, cabecalhoLista("Cancelamentos", { subtitulo: "Histórico de consultas canceladas" }), conteudo),
  );
  montarNavAdm("inicio");

  try {
    const [ags, cat] = await Promise.all([agendamentoService.listar(), carregarCatalogo({ incluirInativos: true })]);
    const r = resumoCancelamentos(ags, hojeISO());
    const item = (rotulo, valor, extra = "") =>
      h("div", { class: `adm-resumo__item ${extra}` }, h("p", { class: "adm-resumo__rotulo" }, rotulo), h("p", { class: "adm-resumo__valor" }, String(valor)));
    conteudo.replaceChildren(
      h(
        "section",
        { class: "adm-resumo adm-resumo--alerta", "aria-label": "Resumo dos cancelamentos" },
        item("Total de cancelamentos", r.total, "adm-resumo__item--grande"),
        item("Este mês", r.esteMes, "adm-resumo__item--dir"),
      ),
      h("div", { class: "adm-cartoes adm-cartoes--canc" }, r.itens.length ? r.itens.map((a) => cartao(a, cat)) : [vazioAdm("Nenhum cancelamento registrado.")]),
    );
  } catch (erro) {
    conteudo.replaceChildren(avisoAdm(erro.message));
  }
}

const sessao = exigirLogin([PERFIS.ADMIN]);
if (sessao) iniciar();
