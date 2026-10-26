// Formulário de profissional: "Novo profissional" (sem ?id) e "Editar profissional" (?id=N). Mesmos campos nas duas.
import { exigirLogin, PERFIS } from "../core/guard.js";
import { h, $, toast } from "../core/dom.js";
import { registrarPwa } from "../pwa.js";
import { profissionalService } from "../services/profissionalService.js";
import { clinicaService } from "../services/clinicaService.js";
import { especialidadeService } from "../services/especialidadeService.js";
import { formatarCPF, formatarTelefone, aplicarMascara, apenasDigitos, cpfValido } from "../ui/mascaras.js";
import { barraAdm, campoAdm, linhaStatus, normalizar, avisoAdm } from "../ui/admin.js";

const idEdicao = Number(new URLSearchParams(location.search).get("id")) || null;
const CONSELHOS = ["CRM", "CREFITO", "CRO"];

// "12345-PE" -> { registro: "12345", uf: "PE" } (aceita "/" no lugar do hífen); null se estiver fora do formato.
function lerRegistro(texto) {
  const m = /^\s*(\d{3,10})\s*[-/]\s*([A-Za-z]{2})\s*$/.exec(String(texto ?? ""));
  return m ? { registro: m[1], uf: m[2].toUpperCase() } : null;
}

// Mostra o registro como no placeholder, sem repetir a UF quando o registro já a traz.
const registroParaCampo = (registro, uf) =>
  !registro ? "" : !uf || new RegExp(`[-/]${uf}$`, "i").test(registro) ? String(registro) : `${registro}-${uf}`;

async function iniciar() {
  registrarPwa();
  const titulo = idEdicao ? "Editar profissional" : "Novo profissional";
  document.title = `${titulo} | TriaOrto+ Administração`;

  const f = {
    nome: campoAdm("nome", "Nome completo", { required: true, maxlength: "150" }),
    cpf: campoAdm("cpf", "CPF", { placeholder: "000.000.000-00", required: true, inputmode: "numeric", maxlength: "14" }),
    registro: campoAdm("registro", "Registro profissional", { placeholder: "Ex: 12345-PE", required: true, maxlength: "16" }),
    especialidade: campoAdm("especialidade", "Especialidade", { placeholder: "Ex: Ortopedia", required: true, list: "lista-especialidades", maxlength: "200" }),
    telefone: campoAdm("telefone", "Telefone", { type: "tel", inputmode: "tel", maxlength: "15" }),
    email: campoAdm("email", "E-mail", { type: "email", required: true, maxlength: "150" }),
  };
  aplicarMascara(f.cpf.input, formatarCPF);
  aplicarMascara(f.telefone.input, formatarTelefone);

  // Conselho (um dos três)
  const radios = CONSELHOS.map((c, i) => {
    const entrada = h("input", { type: "radio", name: "conselho", value: c, checked: i === 0 });
    return { c, entrada, el: h("label", { class: "adm-opcao" }, entrada, h("span", {}, c)) };
  });
  const conselhoErro = h("p", { class: "adm-campo__erro", role: "alert" });
  const conselho = h(
    "fieldset",
    { class: "adm-grupo" },
    h("legend", {}, "Conselho"),
    h("div", { class: "adm-opcoes" }, radios.map((r) => r.el)),
    conselhoErro,
  );

  const datalist = h("datalist", { id: "lista-especialidades" });

  // Clínicas
  const clinicasErro = h("p", { class: "adm-campo__erro", role: "alert" });
  const lista = h("ul", { class: "adm-marcas" }, h("li", { class: "adm-marcas__vazio" }, "Carregando clínicas..."));
  const clinicasGrupo = h(
    "fieldset",
    { class: "adm-grupo" },
    h("legend", {}, "Clínicas vinculadas"),
    h("p", { class: "adm-grupo__dica" }, "Selecione uma ou mais clínicas"),
    lista,
    clinicasErro,
  );
  let clinicas = [];
  const marcadas = new Set();
  const desenharClinicas = () =>
    lista.replaceChildren(
      ...(clinicas.length
        ? clinicas.map((c) => {
            const caixa = h("input", { type: "checkbox", value: String(c.id), checked: marcadas.has(c.id) });
            caixa.addEventListener("change", () => (caixa.checked ? marcadas.add(c.id) : marcadas.delete(c.id)));
            return h("li", {}, h("label", { class: "adm-marca" }, caixa, h("span", { class: "adm-marca__caixa", "aria-hidden": "true" }), c.nome));
          })
        : [h("li", { class: "adm-marcas__vazio" }, "Nenhuma clínica cadastrada.")]),
    );

  const status = linhaStatus(true);
  const salvar = h("button", { class: "adm-salvar", type: "submit" }, "Salvar profissional");
  const aviso = h("div", { "aria-live": "polite" });
  const form = h(
    "form",
    { class: "adm-form", novalidate: true },
    f.nome.el,
    f.cpf.el,
    f.registro.el,
    conselho,
    f.especialidade.el,
    f.telefone.el,
    f.email.el,
    clinicasGrupo,
    status.el,
    aviso,
    salvar,
    datalist,
  );
  $("#conteudo").replaceChildren(barraAdm(titulo, "adm-profissionais.html"), form);

  // Dados de apoio (e, na edição, do profissional)
  let todasEsp = [];
  let profissional = null;
  let cpfOriginal = "";
  try {
    const [cls, esps, prof, vinculos, profEsp] = await Promise.all([
      clinicaService.listar({ apenasAtivas: false }),
      especialidadeService.listar({ apenasAtivas: false }),
      idEdicao ? profissionalService.buscar(idEdicao) : null,
      idEdicao ? profissionalService.listarVinculos({ apenasAtivos: true }) : [],
      idEdicao ? profissionalService.listarEspecialidades() : [],
    ]);
    if (idEdicao && !prof) throw new Error("Profissional não encontrado.");
    todasEsp = esps;
    datalist.replaceChildren(...esps.filter((e) => e.ativo).map((e) => h("option", { value: e.nome })));
    if (prof) {
      profissional = prof;
      f.nome.input.value = prof.nome;
      cpfOriginal = apenasDigitos(prof.cpf);
      f.cpf.input.value = formatarCPF(prof.cpf);
      f.registro.input.value = registroParaCampo(prof.registro, prof.uf);
      radios.forEach((r) => (r.entrada.checked = r.c === String(prof.conselho ?? "").toUpperCase()));
      f.telefone.input.value = formatarTelefone(prof.telefone);
      f.email.input.value = prof.email;
      status.definir(prof.ativo);
      const idsEsp = profEsp.filter((x) => x.idProfissional === idEdicao).map((x) => x.idEspecialidade);
      f.especialidade.input.value = esps.filter((e) => idsEsp.includes(e.id)).map((e) => e.nome).join(", ");
      vinculos.filter((v) => v.idProfissional === idEdicao).forEach((v) => marcadas.add(v.idClinica));
    }
    // Clínicas inativas só aparecem se o profissional já estiver vinculado a elas.
    clinicas = cls.filter((c) => c.ativo || marcadas.has(c.id)).sort((a, b) => a.id - b.id);
  } catch (erro) {
    aviso.replaceChildren(avisoAdm(idEdicao ? `Não foi possível carregar o profissional. ${erro.message}` : erro.message));
    if (idEdicao) salvar.disabled = true;
  }
  desenharClinicas();

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    for (const c of Object.values(f)) c.erro.textContent = "";
    conselhoErro.textContent = clinicasErro.textContent = "";
    aviso.replaceChildren();

    const nome = f.nome.input.value.trim();
    if (!nome) f.nome.erro.textContent = "Informe o nome completo.";

    const cpf = apenasDigitos(f.cpf.input.value);
    // CPF já gravado e não alterado não é revalidado (os dados de teste do banco usam CPFs fictícios).
    if (cpf.length !== 11 || (!(idEdicao && cpf === cpfOriginal) && !cpfValido(cpf))) f.cpf.erro.textContent = "CPF inválido.";

    const reg = lerRegistro(f.registro.input.value);
    if (!reg) f.registro.erro.textContent = "Use o formato 12345-PE (número e UF).";

    const marcado = radios.find((r) => r.entrada.checked);
    if (!marcado) conselhoErro.textContent = "Escolha o conselho.";

    const nomesEsp = f.especialidade.input.value.split(/[,;]/).map((t) => t.trim()).filter(Boolean);
    const idsEsp = [];
    if (!nomesEsp.length) f.especialidade.erro.textContent = "Informe a especialidade.";
    else {
      const desconhecida = nomesEsp.find((n) => !todasEsp.some((e) => normalizar(e.nome).trim() === normalizar(n)));
      if (desconhecida) f.especialidade.erro.textContent = `Especialidade "${desconhecida}" não cadastrada. Cadastre-a em Especialidades.`;
      else nomesEsp.forEach((n) => idsEsp.push(todasEsp.find((e) => normalizar(e.nome).trim() === normalizar(n)).id));
    }

    const tel = apenasDigitos(f.telefone.input.value);
    if (tel && tel.length < 10) f.telefone.erro.textContent = "Telefone incompleto.";
    const email = f.email.input.value.trim();
    if (!email || !f.email.input.checkValidity()) f.email.erro.textContent = "Informe um e-mail válido.";
    if (!marcadas.size) clinicasErro.textContent = "Selecione ao menos uma clínica.";

    const primeiro = Object.values(f).find((c) => c.erro.textContent);
    if (primeiro || conselhoErro.textContent || clinicasErro.textContent) return (primeiro?.input ?? (conselhoErro.textContent ? radios[0].entrada : lista.querySelector("input")))?.focus();

    const dados = {
      nome,
      email,
      telefone: f.telefone.input.value,
      cpf: f.cpf.input.value,
      conselho: marcado.c,
      registro: reg.registro,
      uf: reg.uf,
      ativo: status.estado(),
      idsClinicas: [...marcadas],
      idsEspecialidades: [...new Set(idsEsp)],
    };
    salvar.disabled = true;
    salvar.textContent = "Salvando...";
    try {
      if (idEdicao) await profissionalService.atualizarPeloAdmin(idEdicao, { ...dados, idUsuario: profissional.idUsuario });
      else await profissionalService.criarPeloAdmin(dados);
      toast(idEdicao ? "Profissional atualizado." : "Profissional cadastrado.", "sucesso");
      setTimeout(() => (location.href = "adm-profissionais.html"), 700);
    } catch (erro) {
      aviso.replaceChildren(avisoAdm(/unique|duplic|already|e-?mail|cpf/i.test(erro.message) ? "Já existe um cadastro com este e-mail ou CPF." : erro.message));
      salvar.disabled = false;
      salvar.textContent = "Salvar profissional";
    }
  });
}

const sessao = exigirLogin([PERFIS.ADMIN]);
if (sessao) iniciar();
