# TriaOrto+: Front-end Web (MVP)

Ortopedia e Fisioterapia Ortopédica. Front-end em **HTML, CSS e JavaScript puro (módulos ES)**, PWA, mobile-first
e com foco em acessibilidade (fonte grande, alvos de toque de 48 px, contraste alto, modo escuro automático).
Consome a API REST do back-end `backend-saude-na-palma-da-mao-express`.

## Executar localmente

Não há build nem dependências. Basta servir a pasta por HTTP (módulos ES e service worker não funcionam em `file://`):

```bash
python3 -m http.server 5500
# abra http://localhost:5500
```

Ou use a extensão *Live Server* do VS Code. A URL da API fica em `js/config.js`.

## Publicar no GitHub Pages

Todos os caminhos são relativos, então funciona em `https://usuario.github.io/repositorio/`.
Em *Settings > Pages*, escolha a branch e a pasta raiz. Ao publicar nova versão, aumente `CACHE_VERSION` em `sw.js`
para os celulares receberem os arquivos novos.

## Fluxo de telas (segue o Figma)

```
index.html (início)
 ├─ Entrar    -> login.html (e-mail ou CPF + senha) -> paciente: home.html | profissional/administrador: clinicas.html
 └─ Cadastrar -> cadastro.html (etapa 1 de 2: dados pessoais; etapa 2 de 2: contato e acesso) -> login.html
home.html (paciente) -> pretriagem.html (formulário e resultado) -> agendamento.html (5 passos + "Pronto!") | agendamentos.html
barra inferior do paciente: Início (home.html), Agendamentos (agendamentos.html), Perfil (perfil.html)
```

Telas que vieram de SVG do Figma, com medidas e cores exatas: **início, login e home do paciente**.
Telas **inferidas** (ainda sem quadro no Figma): cadastro (as duas etapas, baseadas só no PNG), perfil, o assistente de
agendamento, "Meus agendamentos" e as telas de profissional e administrador. Substitua pelo design oficial quando existir.

Itens do Figma que ainda **não têm back-end** e só mostram um aviso "em breve": "Esqueceu a senha?", "Entrar com o Google"
e "Fazer pré-triagem". O login aceita **e-mail ou CPF** (CPF só de paciente). "Lembrar senha" mantém a sessão
(`localStorage`); desmarcado, a sessão vale só até fechar a aba. A senha em si nunca é guardada.

## Estrutura (camadas)

```
index, login, cadastro .html                telas públicas
home, perfil .html                          telas do paciente (barra inferior)
clinicas, profissionais, disponibilidades,
agendamento, agendamentos .html             app (exige login)
offline.html, manifest.json, sw.js
css/        base.css (tokens da marca, tipografia) e components.css
icons/      logo, wordmark, ilustracao, decoracao-topo (do Figma), ícones do PWA; icons/ui/ ícones das telas
js/
├─ config.js        URL da API, chaves, tempos limite
├─ core/            http (único ponto com fetch), session, guard, dom, datetime
├─ mappers/         converte o JSON da API (snake_case, ids em string) para o formato do front
├─ services/        uma função por operação da API; nunca tocam no DOM
├─ ui/              layout/menu, catálogo (junção dos cadastros), máscaras, diálogo
└─ pages/           um controller por tela
```

Fluxo de dependência: `pages -> services -> core/http`, e `pages -> ui` para desenhar.
Dados vindos da API entram na tela sempre como texto (`textContent`), nunca como HTML.

### Identidade visual

As cores e a escala de tipografia estão em variáveis no topo de `css/base.css` (`--cor-primaria` etc.),
extraídas do SVG do Figma da tela inicial (`#0F7A6D`, `#A7D7C5`, `#F8FAF7`, `#6B7280`, `#1F2937`). Trocar a paleta é editar esse bloco.
Fonte: `Plus Jakarta Sans` / `DM Sans` se estiverem instaladas, senão a fonte do sistema. Para usar a fonte oficial,
coloque os arquivos em `css/fonts/`, declare `@font-face` em `base.css` e inclua-os em `sw.js`.
`icons/logo.svg`, `wordmark*.svg`, `ilustracao.svg`, `decoracao-topo.svg` e os ícones do PWA vêm do SVG exportado do Figma (quadro "inicio"). As demais telas ainda são inferidas.

## Responsividade

O layout é **mobile-first**: abaixo de 768 px as telas seguem exatamente o Figma (frames de 390 px). Os ajustes para tablet e
computador ficam no **fim de cada CSS de módulo**, dentro de `@media (min-width: 768px)` e `(min-width: 1100px)`:

| Largura | O que muda |
|---|---|
| até 767 px (celular) | nada: layout do Figma |
| 768 px ou mais (tablet) | conteúdo e barra inferior passam a 720 px; listas de cartões em 2 colunas; folhas de confirmação viram janelas centralizadas |
| 1100 px ou mais (computador) | conteúdo e barra inferior passam a 960 px; listas em até 3 colunas |

A largura de cada módulo é uma variável (`--pac-larg`, `--prof-larg`, `--adm-larg`). Formulários e telas de leitura
(editar perfil, senha, detalhes, perfil) ficam numa coluna de 560 a 600 px, centralizada. Ao criar uma tela nova, use as classes de
lista existentes (ou acrescente a sua à regra de grade do módulo) e teste em 360, 390, 768 e 1280 px.

## Perfis e telas do app

| Perfil | Telas |
|---|---|
| Paciente | Início (home), Pré-triagem, Agendar consulta (assistente de 5 passos: especialidade, local, profissional, data, horário), Meus agendamentos, Perfil. A lista de Clínicas continua em `clinicas.html`, mas não tem atalho no design |
| Profissional | Clínicas, Meus horários (disponibilidade), Minha agenda (confirmar, concluir, cancelar) |
| Administrador | Clínicas, Profissionais (cadastro completo), Horários, Agendamentos |

O **primeiro administrador** não pode ser criado pela tela. Crie-o direto na API (ex.: no `requisicoes_test.http` do back-end):

```http
POST {{baseUrl}}/usuarios
Content-Type: application/json

{ "nome": "Administrador", "email": "admin@exemplo.com", "senha_hash": "troque-esta-senha",
  "telefone": "81999998888", "tipo_usuario": "ADMINISTRADOR" }
```

## Ordem para testar de ponta a ponta

1. Admin: entrar pela porta do administrador, abrir **Profissionais**, cadastrar um profissional (já vincula clínica e especialidades).
   Pré-requisito: existir ao menos uma clínica e uma especialidade, e a clínica ligada à especialidade
   (`/clinica-especialidade`). Esses três cadastros ainda não têm tela; use a API.
2. Admin ou profissional: **Horários**, criar uma janela (ex.: 08:00 às 12:00, 30 min).
3. Paciente: **Cadastrar**, entrar, **Agendar consulta**.
4. Profissional/admin: **Agenda**, confirmar a consulta.

## Autenticação provisória (importante)

O back-end ainda não tem `POST /auth/login`, JWT nem hash de senha. Por isso `js/services/authService.js`
baixa a lista de usuários e compara e-mail e senha **no navegador**. Isso só serve para demonstração:

- a API entrega o campo `senha_hash` de todos os usuários a qualquer cliente;
- a senha é gravada exatamente como digitada;
- qualquer pessoa pode se passar por outro usuário.

Quando existir login real, só `authService.js` muda (`login` e `registrarPaciente`); `http.js` já aceita um `token`.
As guardas de perfil do front (`core/guard.js` e a checagem do perfil no login) são conveniência de interface, não segurança.

## Comportamentos que dependem do back-end

- **Sem filtros na API:** listas vêm completas e são filtradas no navegador.
- **Sem validação de conflito:** o front confere os horários logo antes de gravar e trata o caso "já ocupado",
  mas só uma regra no servidor (ex.: índice único em `id_profissional_clinica + data_hora`) elimina a corrida.
- **Sem transações:** cadastros em várias etapas (paciente, profissional) desfazem o que já criaram se uma etapa falhar.
- **Fuso horário:** `data_hora` é `timestamp` sem fuso. O front envia `AAAA-MM-DDTHH:MM:00` e trata o valor devolvido
  como horário de parede. Se um agendamento de teste aparecer deslocado, ajuste `DATAHORA_OFFSET_MIN` em `js/config.js`.
- **Render (plano gratuito):** a primeira chamada pode levar cerca de 1 minuto. A tela avisa o usuário depois de 4 s.
- **Cancelar** muda o status para `CANCELADO` (preserva o histórico) em vez de apagar o registro.
- **Sexo** não é coletado no cadastro (o protótipo não prevê); a coluna é opcional na API.

## PWA

`manifest.json` + `sw.js`: o *app shell* é pré-cacheado e as páginas abrem offline com aviso.
Chamadas à API **nunca** passam pelo cache, porque trazem dados de saúde e de usuários.
