// "Agendamentos hoje": resumo do dia e próximos atendimentos (somente leitura).
import { exigirLogin, PERFIS } from "../core/guard.js";
import { h, $ } from "../core/dom.js";
import { registrarPwa } from "../pwa.js";
import { hojeISO, agoraHHMM, formatarDataCurta } from "../core/datetime.js";
import { carregarCatalogo } from "../ui/catalogo.js";
import { agendamentoService } from "../services/agendamentoService.js";
import { resumoAgendamentos, dataPorExtenso } from "../services/adminService.js";
import { cabecalhoLista, montarNavAdm, avisoAdm, vazioAdm } from "../ui/admin.js";

function resumo(r) {
  const item = (rotulo, valor, extra = "") =>
    h("div", { class: `adm-resumo__item ${extra}` }, h("p", { class: "adm-resumo__rotulo" }, rotulo), h("p", { class: "adm-resumo__valor" }, String(valor)));
  return h(
    "section",
    { class: "adm-resumo", "aria-label": "Resumo do dia" },
    item("Total hoje", r.total, "adm-resumo__item--grande"),
    item("Concluídos", r.concluidos, "adm-resumo__item--dir"),
    item("Pendentes", r.pendentes, "adm-resumo__item--dir"),
  );
}

function cartao(a, cat, hoje) {
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
      h("span", { class: "adm-chip-status adm-chip-status--hora" }, a.hora),
    ),
    esp ? h("p", { class: "adm-ag__esp" }, esp) : null,
    h("p", { class: "adm-cartao__texto" }, clinica?.nome ?? "Clínica não encontrada", a.data !== hoje ? [h("br"), formatarDataCurta(a.data)] : null),
  );
}

async function iniciar() {
  registrarPwa();
  const hoje = hojeISO();
  const conteudo = h("div", { "aria-live": "polite" }, h("p", { class: "adm-vazio" }, "Carregando agendamentos..."));
  $("#conteudo").replaceChildren(
    h("main", { class: "adm-lista" }, cabecalhoLista("Agendamentos hoje", { subtitulo: dataPorExtenso(hoje) }), conteudo),
  );
  montarNavAdm("inicio");

  try {
    const [ags, cat] = await Promise.all([agendamentoService.listar(), carregarCatalogo({ incluirInativos: true })]);
    const r = resumoAgendamentos(ags, hoje, agoraHHMM());
    conteudo.replaceChildren(
      resumo(r),
      h("h2", { class: "adm-subtitulo" }, "Próximos"),
      h("div", { class: "adm-cartoes" }, r.proximos.length ? r.proximos.map((a) => cartao(a, cat, hoje)) : [vazioAdm("Nenhum atendimento pendente.")]),
    );
  } catch (erro) {
    conteudo.replaceChildren(avisoAdm(erro.message));
  }
}

const sessao = exigirLogin([PERFIS.ADMIN]);
if (sessao) iniciar();
