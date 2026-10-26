// Lista de clínicas do administrador: busca, editar e ativar/desativar.
import { exigirLogin, PERFIS } from "../core/guard.js";
import { h, $, toast } from "../core/dom.js";
import { registrarPwa } from "../pwa.js";
import { clinicaService } from "../services/clinicaService.js";
import { confirmar } from "../ui/dialogo.js";
import { cabecalhoLista, montarNavAdm, normalizar, avisoAdm, vazioAdm, icone } from "../ui/admin.js";

const endereco = (c) => [c.ruaNumero, c.cidadeUf].filter(Boolean).join(", ") || "Endereço não informado";

function cartao(c, aoAlternar) {
  if (!c.ativo) {
    // Clínica desativada: cartão esmaecido só com o nome, o aviso "Desativado" e o botão Reativar (como no Figma).
    const reativar = h("button", { class: "adm-btn adm-btn--ativar", type: "button" }, "Reativar");
    reativar.addEventListener("click", () => aoAlternar(c, reativar));
    return h(
      "article",
      { class: "adm-cartao adm-cartao--off" },
      h("div", { class: "adm-off" }, h("div", { class: "adm-off__info" }, h("h2", { class: "adm-cartao__nome" }, c.nome), h("p", { class: "adm-off__estado" }, "Desativado")), reativar),
    );
  }
  const botao = h("button", { class: "adm-btn adm-btn--perigo", type: "button" }, "Desativar");
  botao.addEventListener("click", () => aoAlternar(c, botao));
  return h(
    "article",
    { class: "adm-cartao" },
    h(
      "div",
      { class: "adm-cartao__linha" },
      h("h2", { class: "adm-cartao__nome" }, c.nome),
      h("span", { class: "adm-chip-status" }, "Ativa"),
    ),
    h("p", { class: "adm-cartao__texto" }, endereco(c), h("br"), `CNPJ: ${c.cnpj ?? "—"}`),
    h(
      "div",
      { class: "adm-acoes" },
      h("a", { class: "adm-btn", href: `adm-clinica-form.html?id=${c.id}` }, icone("editar"), "Editar"),
      botao,
    ),
  );
}

async function iniciar() {
  registrarPwa();
  const busca = h("input", { type: "search", placeholder: "Buscar clínica...", "aria-label": "Buscar clínica", autocomplete: "off" });
  const lista = h("div", { class: "adm-cartoes", "aria-live": "polite" }, h("p", { class: "adm-vazio" }, "Carregando clínicas..."));
  $("#conteudo").replaceChildren(
    h(
      "main",
      { class: "adm-lista" },
      cabecalhoLista("Clínicas", { adicionar: "adm-clinica-form.html" }),
      h("div", { class: "adm-busca" }, icone("busca"), busca),
      lista,
    ),
  );
  montarNavAdm("clinicas");

  let clinicas = [];

  const desenhar = () => {
    const termo = normalizar(busca.value.trim());
    const visiveis = clinicas.filter((c) => !termo || normalizar(`${c.nome} ${c.cnpj} ${endereco(c)}`).includes(termo));
    lista.replaceChildren(
      ...(visiveis.length
        ? visiveis.map((c) => cartao(c, alternar))
        : [vazioAdm(clinicas.length ? "Nenhuma clínica encontrada." : "Nenhuma clínica cadastrada.")]),
    );
  };

  async function alternar(c, botao) {
    const novo = !c.ativo;
    if (!novo && !(await confirmar(`Desativar a clínica "${c.nome}"? Ela deixa de aparecer para os pacientes.`, "Desativar"))) return;
    botao.disabled = true;
    try {
      await clinicaService.alterarAtivo(c.id, novo);
      c.ativo = novo;
      toast(novo ? "Clínica ativada." : "Clínica desativada.", "sucesso");
    } catch (erro) {
      toast(erro.message, "erro");
    }
    desenhar();
  }

  busca.addEventListener("input", desenhar);

  try {
    clinicas = (await clinicaService.listar({ apenasAtivas: false })).sort((a, b) => a.id - b.id);
    desenhar();
  } catch (erro) {
    lista.replaceChildren(avisoAdm(erro.message));
  }
}

// Inicia só depois de todas as declarações do módulo (evita acessar let/const antes da inicialização).
const sessao = exigirLogin([PERFIS.ADMIN]);
if (sessao) iniciar();
