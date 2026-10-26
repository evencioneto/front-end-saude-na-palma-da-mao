// Lista de especialidades do administrador: adicionar e apagar (com confirmação).
import { exigirLogin, PERFIS } from "../core/guard.js";
import { h, $, toast } from "../core/dom.js";
import { registrarPwa } from "../pwa.js";
import { especialidadeService } from "../services/especialidadeService.js";
import { cabecalhoLista, montarNavAdm, folhaConfirmar, iconeEspecialidade, avisoAdm, vazioAdm, icone } from "../ui/admin.js";

function cartao(e, aoApagar) {
  return h(
    "article",
    { class: "adm-cartao adm-esp" },
    h("span", { class: "adm-esp__icone", "aria-hidden": "true" }, iconeEspecialidade(e.nome)),
    h(
      "div",
      { class: "adm-esp__info" },
      h("h2", { class: "adm-cartao__nome" }, e.nome),
      h("p", { class: "adm-esp__desc", title: e.descricao || false }, e.descricao || "Sem descrição"),
    ),
    h("span", { class: `adm-chip-status${e.ativo ? "" : " adm-chip-status--inativo"}` }, e.ativo ? "Ativa" : "Inativa"),
    h("button", { class: "adm-apagar", type: "button", "aria-label": `Apagar ${e.nome}`, onclick: () => aoApagar(e) }, icone("lixeira")),
  );
}

async function iniciar() {
  registrarPwa();
  const lista = h("div", { class: "adm-cartoes adm-cartoes--esp", "aria-live": "polite" }, h("p", { class: "adm-vazio" }, "Carregando especialidades..."));
  $("#conteudo").replaceChildren(
    h("main", { class: "adm-lista" }, cabecalhoLista("Especialidades", { adicionar: "adm-especialidade-form.html" }), lista),
  );
  montarNavAdm("inicio"); // no Figma o item "Início" fica em destaque nesta tela

  let especialidades = [];
  const desenhar = () =>
    lista.replaceChildren(...(especialidades.length ? especialidades.map((e) => cartao(e, apagar)) : [vazioAdm("Nenhuma especialidade cadastrada.")]));

  async function apagar(e) {
    const apagou = await folhaConfirmar({
      titulo: "Apagar especialidade?",
      texto: "Esta ação não pode ser desfeita.",
      textoOk: "Apagar",
      aoConfirmar: async () => {
        const uso = await especialidadeService.contarUso(e.id);
        if (uso.clinicas || uso.profissionais) {
          const partes = [];
          if (uso.clinicas) partes.push(`${uso.clinicas} ${uso.clinicas === 1 ? "clínica" : "clínicas"}`);
          if (uso.profissionais) partes.push(`${uso.profissionais} ${uso.profissionais === 1 ? "profissional" : "profissionais"}`);
          throw new Error(`"${e.nome}" está em uso por ${partes.join(" e ")}. Remova esses vínculos antes de apagar.`);
        }
        await especialidadeService.remover(e.id);
      },
    });
    if (!apagou) return;
    especialidades = especialidades.filter((x) => x.id !== e.id);
    toast("Especialidade apagada.", "sucesso");
    desenhar();
  }

  try {
    especialidades = (await especialidadeService.listar({ apenasAtivas: false })).sort((a, b) => a.id - b.id);
    desenhar();
  } catch (erro) {
    lista.replaceChildren(avisoAdm(erro.message));
  }
}

const sessao = exigirLogin([PERFIS.ADMIN]);
if (sessao) iniciar();
