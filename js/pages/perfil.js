// Perfil do paciente: dados da conta, atalhos de configuração e Sair.
import { exigirLogin, PERFIS } from "../core/guard.js";
import { authService } from "../services/authService.js";
import { pacienteApi } from "../services/usuarioService.js";
import { h, $, toast } from "../core/dom.js";
import { barraPac, iconePac } from "../ui/fluxoPaciente.js";
import { iniciais } from "../ui/fluxo.js";
import { montarNavPaciente } from "../ui/navPaciente.js";
import { dataCurta } from "../core/datetime.js";
import { registrarPwa } from "../pwa.js";

// Itens do menu. Os que ainda não têm tela avisam em vez de levar a uma página inexistente.
const MENU = [
  { icone: "perfil-editar", rotulo: "Editar perfil", href: "perfil-editar.html" },
  { icone: "perfil-senha", rotulo: "Alterar senha", aviso: "A alteração de senha estará disponível em breve." },
  { icone: "perfil-aviso", rotulo: "Notificações", href: "notificacoes.html" },
  { icone: "perfil-acess", rotulo: "Acessibilidade", aviso: "As opções de acessibilidade estarão disponíveis em breve." },
];

function item(m) {
  const filhos = [h("span", { class: "pac-plista__icone" }, iconePac(m.icone)), h("span", { class: "pac-plista__rotulo" }, m.rotulo), h("span", { class: "pac-plista__seta" }, iconePac("chevron-menu"))];
  return h(
    "li",
    {},
    m.href
      ? h("a", { class: "pac-plista__item", href: m.href }, filhos)
      : h("button", { class: "pac-plista__item", type: "button", onclick: () => toast(m.aviso) }, filhos),
  );
}

async function iniciar(s) {
  registrarPwa();
  $("#barra").replaceChildren(barraPac("Perfil", "home.html"));
  montarNavPaciente("perfil");

  const nascimento = h("p", { class: "pac-perfil__nasc", id: "p-nascimento", hidden: true });
  $("#conteudo").replaceChildren(
    h(
      "section",
      { class: "pac-perfil__cartao", "aria-label": "Seus dados" },
      h("span", { class: "pac-avatar-grande", "aria-hidden": "true" }, iniciais(s.nome)),
      h("div", { class: "pac-perfil__dados" }, h("h1", { class: "pac-perfil__nome", id: "p-nome" }, s.nome ?? ""), h("p", { class: "pac-perfil__email", id: "p-email" }, s.email ?? ""), nascimento),
    ),
    h("ul", { class: "pac-plista" }, MENU.map(item)),
    h("button", { class: "pac-sair", id: "btn-sair", type: "button", onclick: () => authService.logout() }, h("span", { class: "pac-sair__icone" }, iconePac("perfil-sair")), h("span", { class: "pac-sair__rotulo" }, "Sair")),
  );

  // A data de nascimento é um complemento: se a API falhar, o cartão aparece sem ela.
  try {
    if (s.idPaciente) {
      const p = await pacienteApi.buscar(s.idPaciente);
      const texto = dataCurta(String(p?.data_nascimento ?? "").slice(0, 10));
      if (texto) {
        nascimento.textContent = `Nascimento: ${texto}`;
        nascimento.hidden = false;
      }
    }
  } catch {
    /* sem a data */
  }
}

const sessao = exigirLogin([PERFIS.PACIENTE]);
if (sessao) iniciar(sessao);
