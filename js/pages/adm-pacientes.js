// Lista de pacientes do administrador (somente leitura): busca por nome ou CPF.
import { exigirLogin, PERFIS } from "../core/guard.js";
import { h, $ } from "../core/dom.js";
import { registrarPwa } from "../pwa.js";
import { pacienteService } from "../services/pacienteService.js";
import { formatarCPF, apenasDigitos } from "../ui/mascaras.js";
import { cabecalhoLista, iniciaisNome, montarNavAdm, normalizar, avisoAdm, vazioAdm, icone } from "../ui/admin.js";

const nascimento = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? "")); // sem `new Date`: evita voltar um dia por causa do fuso
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "—";
};
const cpf = (v) => (apenasDigitos(v).length === 11 ? formatarCPF(v) : (v ?? "—"));

function cartao(p) {
  const nome = p.usuario?.nome ?? `Paciente ${p.id}`;
  const ativo = p.usuario?.ativo !== false;
  return h(
    "article",
    { class: "adm-cartao adm-pac" },
    h("div", { class: "adm-avatar", "aria-hidden": "true" }, iniciaisNome(nome)),
    h(
      "div",
      { class: "adm-pac__info" },
      h(
        "div",
        { class: "adm-pac__topo" },
        h("h2", { class: "adm-cartao__nome" }, nome),
        h("span", { class: `adm-chip-status${ativo ? "" : " adm-chip-status--inativo"}` }, ativo ? "Ativo" : "Inativo"),
      ),
      h("p", { class: "adm-pac__dado" }, `CPF: ${cpf(p.cpf)}`),
      h("p", { class: "adm-pac__dado" }, `Nasc.: ${nascimento(p.nascimento)}`),
    ),
  );
}

async function iniciar() {
  registrarPwa();
  const busca = h("input", { type: "search", placeholder: "Buscar paciente...", "aria-label": "Buscar paciente", autocomplete: "off" });
  const lista = h("div", { class: "adm-cartoes", "aria-live": "polite" }, h("p", { class: "adm-vazio" }, "Carregando pacientes..."));
  $("#conteudo").replaceChildren(
    h("main", { class: "adm-lista" }, cabecalhoLista("Pacientes"), h("div", { class: "adm-busca" }, icone("busca"), busca), lista),
  );
  montarNavAdm(null);

  let pacientes = [];
  const desenhar = () => {
    const termo = normalizar(busca.value.trim());
    const digitos = apenasDigitos(busca.value);
    const visiveis = pacientes.filter(
      (p) => !termo || normalizar(p.usuario?.nome ?? "").includes(termo) || (digitos.length >= 3 && apenasDigitos(p.cpf).includes(digitos)),
    );
    lista.replaceChildren(
      ...(visiveis.length ? visiveis.map(cartao) : [vazioAdm(pacientes.length ? "Nenhum paciente encontrado." : "Nenhum paciente cadastrado.")]),
    );
  };
  busca.addEventListener("input", desenhar);

  try {
    pacientes = (await pacienteService.listar()).sort((a, b) => a.id - b.id);
    desenhar();
  } catch (erro) {
    lista.replaceChildren(avisoAdm(erro.message));
  }
}

const sessao = exigirLogin([PERFIS.ADMIN]);
if (sessao) iniciar();
