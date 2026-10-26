// Alterar senha do paciente. Enquanto o back-end não tem login real (ver authService), a senha atual é conferida
// no cadastro e a nova é gravada com PUT /usuarios/:id, do mesmo jeito que o cadastro grava.
import { exigirLogin, PERFIS } from "../core/guard.js";
import { usuarioApi } from "../services/usuarioService.js";
import { h, $, toast, comBotaoOcupado } from "../core/dom.js";
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
    try {
      await comBotaoOcupado(salvar, "Salvando...", async () => {
        const u = await usuarioApi.buscar(s.idUsuario);
        if (!u || u.senha_hash !== atual.input.value) {
          mostrarErro(atual, "A senha atual está incorreta.");
          atual.input.focus();
          return false;
        }
        await usuarioApi.atualizar(s.idUsuario, { senha_hash: nova.input.value });
        return true;
      }).then((feito) => {
        if (!feito) return;
        toast("Senha alterada com sucesso.", "sucesso");
        setTimeout(() => location.assign("perfil.html"), 600);
      });
    } catch (err) {
      toast(err.message, "erro");
    }
  });
}

const sessao = exigirLogin([PERFIS.PACIENTE]);
if (sessao) iniciar(sessao);
