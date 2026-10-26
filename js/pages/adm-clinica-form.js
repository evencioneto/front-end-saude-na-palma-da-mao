// Formulário de clínica: "Nova clínica" (sem ?id) e "Editar clínica" (?id=N). Mesmos campos nas duas.
import { exigirLogin, PERFIS } from "../core/guard.js";
import { h, $, toast } from "../core/dom.js";
import { registrarPwa } from "../pwa.js";
import { clinicaService } from "../services/clinicaService.js";
import { especialidadeService } from "../services/especialidadeService.js";
import { formatarTelefone, formatarCNPJ, aplicarMascara, apenasDigitos } from "../ui/mascaras.js";
import { barraAdm, normalizar, avisoAdm, icone } from "../ui/admin.js";

const idEdicao = Number(new URLSearchParams(location.search).get("id")) || null;

function campo(id, rotulo, atributos = {}) {
  const input = h("input", { id, name: id, type: "text", autocomplete: "off", ...atributos });
  const erro = h("p", { class: "adm-campo__erro", id: `${id}-erro`, role: "alert" });
  input.setAttribute("aria-describedby", `${id}-erro`);
  return { input, erro, el: h("div", { class: "adm-campo" }, h("label", { for: id }, rotulo), input, erro) };
}

async function iniciar() {
  registrarPwa();
  const titulo = idEdicao ? "Editar clínica" : "Nova clínica";
  document.title = `${titulo} | TriaOrto+ Administração`;

  const f = {
    nome: campo("nome", "Nome da clínica", { placeholder: "Ex: Clínica Ortopédica Central", required: true, maxlength: "150" }),
    cnpj: campo("cnpj", "CNPJ", { placeholder: "00.000.000/0000-00", required: true, inputmode: "numeric", maxlength: "18" }),
    endereco: campo("endereco", "Endereço completo", { placeholder: "Rua, número, bairro, cidade", maxlength: "180" }),
    telefone: campo("telefone", "Telefone", { placeholder: "(00) 0000-0000", type: "tel", inputmode: "tel", maxlength: "15" }),
    email: campo("email", "E-mail", { placeholder: "contato@clinica.com.br", type: "email", maxlength: "150" }),
    // O back-end ainda não tem esta coluna: o campo existe no design, mas não é gravado (ver aviso ao salvar).
    horario: campo("horario", "Horário de funcionamento", { placeholder: "Seg–Sex: 08h–18h" }),
  };
  aplicarMascara(f.cnpj.input, formatarCNPJ);
  aplicarMascara(f.telefone.input, formatarTelefone);

  // Especialidades
  const buscaEsp = h("input", { type: "search", placeholder: "Buscar especialidade...", "aria-label": "Buscar especialidade", autocomplete: "off" });
  const chips = h("ul", { class: "adm-chips", "aria-label": "Especialidades atendidas" });
  let especialidades = [];
  const escolhidas = new Set();
  const desenharChips = () => {
    const termo = normalizar(buscaEsp.value.trim());
    const visiveis = especialidades.filter((e) => !termo || normalizar(e.nome).includes(termo));
    chips.replaceChildren(
      ...(visiveis.length
        ? visiveis.map((e) =>
            h(
              "li",
              {},
              h(
                "button",
                {
                  class: "adm-chip",
                  type: "button",
                  "aria-pressed": String(escolhidas.has(e.id)),
                  onclick: (ev) => {
                    escolhidas.has(e.id) ? escolhidas.delete(e.id) : escolhidas.add(e.id);
                    ev.currentTarget.setAttribute("aria-pressed", String(escolhidas.has(e.id)));
                  },
                },
                e.nome,
              ),
            ),
          )
        : [h("li", { class: "adm-chips__vazio" }, especialidades.length ? "Nenhuma especialidade encontrada." : "Carregando especialidades...")]),
    );
  };
  buscaEsp.addEventListener("input", desenharChips);

  // Status
  let ativo = true;
  const chave = h("button", { class: "adm-chave", type: "button", role: "switch", "aria-checked": "true", "aria-labelledby": "rot-status" });
  chave.addEventListener("click", () => {
    ativo = !ativo;
    chave.setAttribute("aria-checked", String(ativo));
  });

  const salvar = h("button", { class: "adm-salvar", type: "submit" }, "Salvar clínica");
  const aviso = h("div", { "aria-live": "polite" });
  const form = h(
    "form",
    { class: "adm-form", novalidate: true },
    f.nome.el,
    f.cnpj.el,
    f.endereco.el,
    f.telefone.el,
    f.email.el,
    f.horario.el,
    h(
      "section",
      { class: "adm-especialidades", "aria-labelledby": "tit-esp" },
      h("h2", { class: "adm-especialidades__titulo", id: "tit-esp" }, "Especialidades atendidas"),
      h("div", { class: "adm-busca" }, icone("busca"), buscaEsp),
      chips,
    ),
    h("div", { class: "adm-status" }, h("span", { id: "rot-status" }, "Status ativo"), chave),
    aviso,
    salvar,
  );

  $("#conteudo").replaceChildren(barraAdm(titulo, "adm-clinicas.html"), form);
  desenharChips();

  // Edição: carrega a clínica e as especialidades que ela já atende.
  let antes = [];
  let enderecoOriginal = "";
  try {
    const [lista, vinculos, clinica] = await Promise.all([
      especialidadeService.listar({ apenasAtivas: true }),
      idEdicao ? clinicaService.listarEspecialidades() : [],
      idEdicao ? clinicaService.buscar(idEdicao) : null,
    ]);
    especialidades = lista.sort((a, b) => a.id - b.id);
    if (clinica) {
      f.nome.input.value = clinica.nome;
      f.cnpj.input.value = clinica.cnpj ?? "";
      enderecoOriginal = clinica.endereco;
      f.endereco.input.value = enderecoOriginal;
      f.telefone.input.value = formatarTelefone(clinica.telefone);
      f.email.input.value = clinica.email;
      ativo = clinica.ativo;
      chave.setAttribute("aria-checked", String(ativo));
      antes = vinculos.filter((v) => v.idClinica === idEdicao).map((v) => v.idEspecialidade);
      antes.forEach((id) => escolhidas.add(id));
    }
    desenharChips();
  } catch (erro) {
    aviso.replaceChildren(avisoAdm(idEdicao ? `Não foi possível carregar a clínica. ${erro.message}` : erro.message));
    if (idEdicao) salvar.disabled = true;
  }

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    for (const c of Object.values(f)) c.erro.textContent = "";
    aviso.replaceChildren();

    const nome = f.nome.input.value.trim();
    if (!nome) f.nome.erro.textContent = "Informe o nome da clínica.";
    // Só confere os 14 dígitos: os dados de teste do banco usam CNPJs fictícios (dígitos verificadores inválidos).
    if (apenasDigitos(f.cnpj.input.value).length !== 14) f.cnpj.erro.textContent = "CNPJ incompleto. Informe os 14 dígitos.";
    const email = f.email.input.value.trim();
    if (email && !f.email.input.checkValidity()) f.email.erro.textContent = "E-mail inválido.";
    const tel = apenasDigitos(f.telefone.input.value);
    if (tel && tel.length < 10) f.telefone.erro.textContent = "Telefone incompleto.";
    const primeiroErro = Object.values(f).find((c) => c.erro.textContent);
    if (primeiroErro) return primeiroErro.input.focus();

    const dados = {
      nome,
      cnpj: f.cnpj.input.value,
      endereco: f.endereco.input.value.trim(),
      telefone: f.telefone.input.value,
      email,
      ativo,
    };
    salvar.disabled = true;
    salvar.textContent = "Salvando...";
    try {
      if (idEdicao) {
        const mudou = dados.endereco !== enderecoOriginal;
        // Se o endereço não mudou, não é enviado (preserva número, bairro, cidade e UF já gravados).
        if (!mudou) delete dados.endereco;
        await clinicaService.atualizar(idEdicao, dados, { antes, depois: [...escolhidas], enderecoMudou: mudou });
      } else {
        await clinicaService.criar(dados, [...escolhidas]);
      }
      toast(idEdicao ? "Clínica atualizada." : "Clínica cadastrada.", "sucesso");
      setTimeout(() => (location.href = "adm-clinicas.html"), 700);
    } catch (erro) {
      aviso.replaceChildren(avisoAdm(/cnpj|unique|duplic|already/i.test(erro.message) ? "Já existe uma clínica com este CNPJ." : erro.message));
      salvar.disabled = false;
      salvar.textContent = "Salvar clínica";
    }
  });
}

const sessao = exigirLogin([PERFIS.ADMIN]);
if (sessao) iniciar();
