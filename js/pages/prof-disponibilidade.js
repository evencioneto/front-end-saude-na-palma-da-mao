// Disponibilidade do profissional: próximos 5 dias úteis, com adicionar (formulário no cartão) e remover horário.
import { exigirLogin, PERFIS } from "../core/guard.js";
import { h, $, carregando, toast, comBotaoOcupado } from "../core/dom.js";
import { registrarPwa } from "../pwa.js";
import { hojeISO } from "../core/datetime.js";
import { profissionalService } from "../services/profissionalService.js";
import { disponibilidadeService } from "../services/disponibilidadeService.js";
import { confirmar } from "../ui/dialogo.js";
import { barraProf, montarNavProf, icone, maiuscula } from "../ui/profissional.js";

const DURACAO_PADRAO_MIN = 30;
let eu, vinculo, janelas = [], dias = [], abertoEm = null, corpo;

const emMin = (t) => {
  const [hh, mm] = t.split(":").map(Number);
  return hh * 60 + mm;
};
const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Próximos 5 dias úteis, começando em hoje (se for dia útil).
function proximosDiasUteis() {
  const lista = [];
  const d = new Date();
  while (lista.length < 5) {
    if (d.getDay() !== 0 && d.getDay() !== 6) lista.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return lista;
}

// "28 De Setembro De 2026" (mesma grafia do design)
const dataTitulo = (d) =>
  d
    .toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })
    .split(" ")
    .map((p) => maiuscula(p))
    .join(" ");

async function carregarJanelas() {
  const todas = await disponibilidadeService.listar();
  janelas = todas
    .filter((j) => j.idVinculo === vinculo.id)
    .sort((a, b) => `${a.data} ${a.horaInicio}`.localeCompare(`${b.data} ${b.horaInicio}`));
}

function desenhar() {
  corpo.replaceChildren(
    h("p", { class: "prof-intro" }, "Configure as datas e os horários em que você está disponível para consultas."),
    h("div", { class: "prof-lista" }, dias.map(cartaoDia)),
  );
}

function cartaoDia(d) {
  const data = iso(d);
  const faixas = janelas.filter((j) => j.data === data);
  const nomeDia = maiuscula(d.toLocaleDateString("pt-BR", { weekday: "long" }));

  const mais = h(
    "button",
    {
      class: "prof-dia__mais",
      type: "button",
      "aria-label": `Adicionar horário em ${nomeDia}`,
      "aria-expanded": abertoEm === data ? "true" : "false",
      onclick: () => {
        abertoEm = abertoEm === data ? null : data;
        desenhar();
      },
    },
    icone("mais", 14),
  );

  return h(
    "section",
    { class: "prof-cartao prof-dia", "aria-label": nomeDia },
    h(
      "div",
      { class: "prof-dia__cabeca" },
      h("div", {}, h("h2", { class: "prof-dia__nome" }, nomeDia), h("p", { class: "prof-dia__data" }, dataTitulo(d))),
      mais,
    ),
    abertoEm === data ? formulario(data) : null,
    h(
      "div",
      { class: "prof-faixas" },
      faixas.length ? faixas.map(faixa) : h("p", { class: "prof-sem-horario" }, "Nenhum horário configurado"),
    ),
  );
}

function faixa(j) {
  const reservado = j.status === "RESERVADO";
  return h(
    "div",
    { class: "prof-faixa" },
    h(
      "span",
      { class: "prof-faixa__hora" },
      `${j.horaInicio} — ${j.horaFim}`,
      reservado ? h("span", { class: "prof-faixa__nota" }, "Reservado") : null,
      j.status === "BLOQUEADO" ? h("span", { class: "prof-faixa__nota" }, "Bloqueado") : null,
    ),
    reservado
      ? null
      : h(
          "button",
          {
            class: "prof-lixeira",
            type: "button",
            "aria-label": `Remover horário ${j.horaInicio} às ${j.horaFim}`,
            onclick: async () => {
              if (!(await confirmar("Remover este horário de atendimento?", "Remover"))) return;
              try {
                await disponibilidadeService.remover(j.id);
                janelas = janelas.filter((x) => x.id !== j.id);
                toast("Horário removido.", "sucesso");
                desenhar();
              } catch (err) {
                toast(err.message, "erro");
              }
            },
          },
          icone("lixeira", 14),
        ),
  );
}

function formulario(dataInicial) {
  const primeiro = iso(dias[0]);
  const ultimo = iso(dias[dias.length - 1]);
  const erro = h("p", { class: "prof-form__erro", role: "alert" });
  const campo = (rotulo, id, attrs) =>
    h("div", {}, h("label", { for: id }, rotulo), h("input", { id, required: true, ...attrs }));

  const cData = campo("Data", "f-data", { type: "date", value: dataInicial, min: primeiro < hojeISO() ? hojeISO() : primeiro, max: ultimo });
  const cIni = campo("Início", "f-ini", { type: "time" });
  const cFim = campo("Fim", "f-fim", { type: "time" });
  const salvar = h("button", { class: "prof-botao prof-botao--primario", type: "submit" }, "Salvar horário");

  const f = h(
    "form",
    { class: "prof-form", novalidate: true },
    cData,
    h("div", { class: "prof-form__linha" }, cIni, cFim),
    erro,
    h(
      "div",
      { class: "prof-form__acoes" },
      h(
        "button",
        {
          class: "prof-botao",
          type: "button",
          onclick: () => {
            abertoEm = null;
            desenhar();
          },
        },
        "Cancelar",
      ),
      salvar,
    ),
  );

  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    erro.textContent = "";
    const data = $("#f-data", f).value;
    const ini = $("#f-ini", f).value;
    const fim = $("#f-fim", f).value;

    if (!data || !ini || !fim) return void (erro.textContent = "Preencha data, início e fim.");
    if (data < hojeISO()) return void (erro.textContent = "Escolha uma data de hoje em diante.");
    if (data < primeiro || data > ultimo) return void (erro.textContent = "Escolha um dos dias listados.");
    if (emMin(fim) <= emMin(ini)) return void (erro.textContent = "O horário final precisa ser depois do inicial.");
    if (emMin(fim) - emMin(ini) < DURACAO_PADRAO_MIN) {
      return void (erro.textContent = `A janela precisa ter pelo menos ${DURACAO_PADRAO_MIN} minutos.`);
    }
    const conflito = janelas.some(
      (j) => j.data === data && emMin(j.horaInicio) < emMin(fim) && emMin(ini) < emMin(j.horaFim),
    );
    if (conflito) return void (erro.textContent = "Já existe um horário que se sobrepõe a este.");

    try {
      await comBotaoOcupado(salvar, "Salvando...", () =>
        disponibilidadeService.criar({
          idVinculo: vinculo.id,
          data,
          horaInicio: ini,
          horaFim: fim,
          duracaoMinutos: DURACAO_PADRAO_MIN,
        }),
      );
      toast("Horário adicionado.", "sucesso");
      abertoEm = null;
      await carregarJanelas();
      desenhar();
    } catch (err) {
      erro.textContent = err.message;
    }
  });
  return f;
}

async function iniciar(s) {
  eu = s;
  registrarPwa();
  dias = proximosDiasUteis();
  corpo = h("div", { class: "prof-corpo" }, carregando("Carregando horários..."));
  $("#conteudo").replaceChildren(barraProf("Disponibilidade"), corpo);
  montarNavProf(null);

  try {
    const vinculos = (await profissionalService.listarVinculos()).filter((v) => v.idProfissional === eu.idProfissional);
    vinculo = vinculos[0];
    if (!vinculo) {
      corpo.replaceChildren(
        h("p", { class: "prof-vazio" }, "Seu cadastro ainda não está vinculado a uma clínica. Procure a administração."),
      );
      return;
    }
    await carregarJanelas();
    desenhar();
  } catch (err) {
    corpo.replaceChildren(h("p", { class: "prof-vazio", role: "alert" }, err.message));
  }
}

const sessao = exigirLogin([PERFIS.PROFISSIONAL]);
if (sessao) iniciar(sessao);
