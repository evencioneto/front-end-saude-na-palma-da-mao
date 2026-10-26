// Lista de profissionais do administrador: busca e ativar/desativar.
import { exigirLogin, PERFIS } from "../core/guard.js";
import { h, $, toast } from "../core/dom.js";
import { registrarPwa } from "../pwa.js";
import { profissionalService } from "../services/profissionalService.js";
import { carregarCatalogo } from "../ui/catalogo.js";
import { confirmar } from "../ui/dialogo.js";
import { cabecalhoLista, iniciaisNome, montarNavAdm, normalizar, avisoAdm, vazioAdm, icone } from "../ui/admin.js";

const CORES = ["#0f7a6d", "#7c3aed", "#b45309", "#db2777", "#0369a1"];

// "CRM 12345-PE" (não repete a UF se o registro já terminar com ela)
const registro = (p) => {
  const num = p.registro && p.uf && !String(p.registro).toUpperCase().endsWith(`-${p.uf.toUpperCase()}`) ? `${p.registro}-${p.uf}` : (p.registro ?? "");
  return [p.conselho, num].filter(Boolean).join(" ");
};

function cartao(p, i, ctx, aoAlternar) {
  const botao = h("button", { class: `adm-btn ${p.ativo ? "adm-btn--perigo" : "adm-btn--ativar"}`, type: "button" }, p.ativo ? "Desativar" : "Ativar");
  botao.addEventListener("click", () => aoAlternar(p, botao));
  return h(
    "article",
    { class: "adm-cartao adm-prof" },
    h(
      "div",
      { class: "adm-prof__linha" },
      h("div", { class: "adm-avatar", style: `background:${CORES[i % CORES.length]}`, "aria-hidden": "true" }, iniciaisNome(p.nome)),
      h(
        "div",
        { class: "adm-prof__info" },
        h("h2", { class: "adm-cartao__nome" }, p.nome),
        h("p", { class: "adm-prof__esp" }, ctx.especialidades(p.id) || "Sem especialidade"),
        h("p", { class: "adm-prof__reg" }, registro(p)),
      ),
      h("span", { class: `adm-chip-status${p.ativo ? "" : " adm-chip-status--inativo"}` }, p.ativo ? "Ativo" : "Inativo"),
    ),
    h("p", { class: "adm-cartao__texto" }, ctx.clinica(p.id) || "Sem clínica vinculada"),
    h(
      "div",
      { class: "adm-acoes" },
      h("a", { class: "adm-btn", href: `adm-profissional-form.html?id=${p.id}` }, icone("editar"), "Editar"),
      botao,
    ),
  );
}

async function iniciar() {
  registrarPwa();
  const busca = h("input", { type: "search", placeholder: "Buscar profissional...", "aria-label": "Buscar profissional", autocomplete: "off" });
  const lista = h("div", { class: "adm-cartoes", "aria-live": "polite" }, h("p", { class: "adm-vazio" }, "Carregando profissionais..."));
  $("#conteudo").replaceChildren(
    h(
      "main",
      { class: "adm-lista" },
      cabecalhoLista("Profissionais", { adicionar: "adm-profissional-form.html" }),
      h("div", { class: "adm-busca" }, icone("busca"), busca),
      lista,
    ),
  );
  montarNavAdm(null); // no Figma, nenhum item da barra fica em destaque nesta tela

  let profissionais = [];
  let ctx = { especialidades: () => "", clinica: () => "" };

  const desenhar = () => {
    const termo = normalizar(busca.value.trim());
    const visiveis = profissionais
      .map((p, i) => [p, i])
      .filter(([p]) => !termo || normalizar(`${p.nome} ${ctx.especialidades(p.id)} ${registro(p)} ${ctx.clinica(p.id)}`).includes(termo));
    lista.replaceChildren(
      ...(visiveis.length
        ? visiveis.map(([p, i]) => cartao(p, i, ctx, alternar))
        : [vazioAdm(profissionais.length ? "Nenhum profissional encontrado." : "Nenhum profissional cadastrado.")]),
    );
  };

  async function alternar(p, botao) {
    const novo = !p.ativo;
    if (!novo && !(await confirmar(`Desativar ${p.nome}? Ele deixa de aparecer para agendamento.`, "Desativar"))) return;
    botao.disabled = true;
    try {
      await profissionalService.alterarAtivo(p.id, novo);
      p.ativo = novo;
      toast(novo ? "Profissional ativado." : "Profissional desativado.", "sucesso");
    } catch (erro) {
      toast(erro.message, "erro");
    }
    desenhar();
  }

  busca.addEventListener("input", desenhar);

  try {
    const cat = await carregarCatalogo({ incluirInativos: true });
    profissionais = [...cat.profissionais].sort((a, b) => a.id - b.id);
    ctx = {
      especialidades: (id) =>
        cat.profEsp
          .filter((x) => x.idProfissional === id)
          .map((x) => cat.especialidadePorId.get(x.idEspecialidade)?.nome)
          .filter(Boolean)
          .join(", "),
      clinica: (id) => {
        const v = cat.vinculos.find((x) => x.idProfissional === id && x.ativo) ?? cat.vinculos.find((x) => x.idProfissional === id);
        return v ? cat.clinicaPorId.get(v.idClinica)?.nome : "";
      },
    };
    desenhar();
  } catch (erro) {
    lista.replaceChildren(avisoAdm(erro.message));
  }
}

const sessao = exigirLogin([PERFIS.ADMIN]);
if (sessao) iniciar();
