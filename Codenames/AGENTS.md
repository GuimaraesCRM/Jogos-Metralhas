# Instruções para agentes de IA — pasta `Codenames/`

As regras da raiz continuam valendo por inteiro. Leia `AGENTS.md`,
`RESPONSAVEIS.md` e `CONTRIBUTING.md` na raiz do repositório antes de qualquer
alteração. Este arquivo **não** amplia o escopo definido lá: ele só acrescenta o
que é específico deste jogo.

## Identidade e escopo

| | |
| --- | --- |
| **Jogo** | Codenames (nome do app: Palavras Secretas) |
| **Caminho autorizado** | `Codenames/` e nada além disso |
| **Responsável proposto** | @lukinhasbh98 |
| **Situação do cadastro** | **Pendente**. Este é o primeiro PR de um jogo novo, pela exceção prevista no `AGENTS.md` da raiz. Só o Guilherme (@GuimaraesCRM) cadastra o responsável em `RESPONSAVEIS.md` e aprova a integração. |

Uma tarefa neste jogo autoriza alterações **somente dentro de `Codenames/`**.
Não edite, mova nem formate arquivos da raiz, de `.github/`, do cadastro de
responsáveis ou de qualquer outro jogo. Não crie dependência entre pastas de
jogos. Se a solução parecer exigir algo fora daqui, pare e encaminhe ao
Guilherme.

Antes de commitar, confira os caminhos: `git status --short` e
`git diff --cached --name-only` devem mostrar apenas `Codenames/...`. Adicione
com caminho explícito (`git add -- Codenames/`), nunca com `git add .`.

## Comandos (todos rodam de dentro de `Codenames/`)

```bash
npm install          # dependências (ficam em Codenames/node_modules)
npm run dev          # servidor local + 4 janelas do jogo
npm test             # regras + integração (18 testes)
npm run build        # gera os .exe em Codenames/dist
```

Tudo o que estes comandos escrevem fica dentro de `Codenames/`:
`node_modules/`, `dist/` e `build/`, todos ignorados pelo `.gitignore` local.
Nenhum deles grava fora da pasta do jogo.

## Como o código está organizado

- `shared/regras.js` — regras do jogo em funções **puras**. É a fonte de verdade
  de como uma partida evolui. Alterou regra? Atualize `shared/regras.test.js`.
- `shared/palavras.js` — banco de palavras em português.
- `shared/protocolo.js` — nomes das mensagens e validações compartilhadas.
- `server/` — salas, aplicação das regras e projeção do estado por jogador.
- `renderer/` — interface. Não calcula regra nenhuma: desenha o estado recebido.
- `electron/main.cjs` — janela e protocolo `app://`. É CommonJS de propósito
  (veja o comentário no topo do arquivo antes de tentar convertê-lo para ESM).

## Regras técnicas deste jogo

1. **O servidor é autoritativo e a projeção do estado é anticola.** O operativo
   nunca pode receber a cor de uma carta fechada. Ao mexer em `server/vistas.js`
   ou no formato do estado, garanta que continua assim — há teste para isso em
   `server/integracao.test.js`, não o enfraqueça.
2. **Regra de jogo se escreve em `shared/regras.js`**, nunca no cliente. O
   cliente valida só o que é conforto de digitação; quem decide é o servidor.
3. **O relógio do turno é do servidor.** O cliente apenas desenha a contagem, a
   partir de `turnoTerminaEm` e do desvio calculado com `agora`. Não mova a
   decisão de "o tempo acabou" para o app.
4. **A interface não tem build step.** Módulos ES servidos pelo protocolo
   `app://`. Não introduza bundler, framework ou dependência de runtime na
   interface sem uma boa razão.
5. **Nada de recurso externo em tempo de execução.** As fontes são `.woff2`
   locais e a CSP em `renderer/index.html` bloqueia script e estilo remotos.
   Precisa de outro recurso? Embarque.
6. **Textos da interface em português**, incluindo mensagens de erro do
   servidor, que aparecem para o jogador.

## Antes de dizer que terminou

Rode `npm test`. Se mexeu na interface, abra com `npm run dev` e jogue uma
partida até o fim — o teste automatizado não vê layout quebrado. Informe o que
mudou, o que foi validado e a situação da publicação.
