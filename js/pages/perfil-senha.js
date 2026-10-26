// Alterar senha do paciente. A tela valida os campos, mas o servidor ainda não tem uma rota para o paciente trocar a
// própria senha: quando existir, o envio entra no fim do submit (hoje só avisa).
import { exigirLogin, PERFIS } from "../core/guard.js";
import { h, $, toast } from "../core/dom.js";
import { barraPac } from "../ui/fluxoPaciente.js";
import { campo, mostrarErro } from "../ui/campoPaciente.js";
import { registrarPwa } from "../pwa.js";

const MINIMO = 8;

function iniciar(s) {
  registrarPwa();
  $("#barra").replaceChildren(barraPac("Alterar senha", "perfil.html"));

  const atual = campo({ id: "s-atual", rotulo: "Senha atual", tipo: "password", autocomplete: "current-password" });
  const nova = campo({ id: "s-nova", rotulo: "Nova senha", tipo: "password", autocomplete: "new-password", placeholder: `Mínimo ${MINIMO} caracteres` });
  const confirmacao = campo({ id: "s-confirmacao", rotulo: "Confirmar nova senha", tipo: "password", autocomplete: "new-password", placeholder: "Repita a nova senha" });
  const salvar = h("button", { class: "pac-btn", id: "salvar", type: "submit", disabled: true }, "Salvar nova senha");
  const campos = [atual, nova, confirmacao];

  // O botão só liga quando os três campos têm algo; o que estiver errado é explicado ao enviar.
  const atualizarBotao = () => (salvar.disabled = !campos.every((c) => c.input.value !== ""));
  campos.forEach((c) => c.input.addEventListener("input", () => { mostrarErro(c, ""); atualizarBotao(); }));

  const form = h("form", { class: "pac-editar__form", novalidate: true }, ...campos.map((c) => c.el), salvar);
  $("#conteudo").replaceChildren(form);

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const ok = [
      mostrarErro(nova, nova.input.value.length < MINIMO ? `A nova senha precisa ter pelo menos ${MINIMO} caracteres.` : nova.input.value === atual.input.value ? "A nova senha deve ser diferente da atual." : ""),
      mostrarErro(confirmacao, confirmacao.input.value !== nova.input.value ? "As senhas não são iguais." : ""),
    ].every(Boolean);
    if (!ok) {
      form.querySelector("[aria-invalid=true]")?.focus();
      return;
    }
    // O servidor ainda não tem rota para o paciente trocar a própria senha (PUT /usuarios é só do administrador e
    // não faz o hash). Gravar do jeito antigo trancaria a conta, então nada é enviado.
    toast("A troca de senha ainda não está disponível no servidor. Em breve!");
  });
}

const sessao = exigirLogin([PERFIS.PACIENTE]);
if (sessao) iniciar(sessao);
