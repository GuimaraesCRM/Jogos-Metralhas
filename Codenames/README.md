# Codenames — Palavras Secretas

Jogo de dedução por associação de palavras no estilo Codenames, em português,
para o grupo jogar junto pela internet. Aplicativo desktop para Windows: cada
pessoa abre o `.exe`, digita o nome, entra numa sala por código de 4 letras e
joga com o tabuleiro atualizando em tempo real para todo mundo.

| | |
| --- | --- |
| **Jogo** | Codenames (nome do app: Palavras Secretas) |
| **Pasta** | `Codenames/` |
| **Responsável proposto** | @lukinhasbh98 |
| **Situação do cadastro** | **Pendente** — primeiro PR de jogo novo, conforme a exceção do `AGENTS.md` da raiz. O cadastro em `RESPONSAVEIS.md` é feito pelo Guilherme (@GuimaraesCRM) na revisão. |
| **Estado** | Jogável de ponta a ponta e empacotado. Partida completa, reconexão, placar, relógio e fim de jogo funcionando. |

## Como se joga

Vinte e cinco cartas com palavras, num grid 5x5. Dois times, vermelho e azul.
Cada time tem um **mestre-espião**, que enxerga a cor secreta de cada carta, e
um ou mais **operativos**, que veem o tabuleiro fechado.

- O time que começa tem **9** cartas; o outro, **8**. Há **7** neutras e **1**
  assassino.
- Na sua vez, o mestre-espião diz **uma palavra e um número** ("FRUTA 3"),
  ligando a dica a cartas do próprio time.
- Os operativos discutem e escolhem cartas, uma de cada vez. A dica de número N
  dá **N+1** palpites.
- Carta do próprio time: continua. Carta do adversário ou neutra: passa a vez.
  **Assassino: derrota imediata.**
- Vence quem revelar todas as próprias cartas primeiro.

Duas opções ajustáveis na sala:

- **Tempo por turno** — sem tempo, 60s, 90s, 120s ou um valor livre entre 15 e
  900 segundos. O anfitrião pode mudar durante a partida; vale do próximo turno
  em diante (desligar o relógio vale na hora).
- **Como a carta vira** — *por consenso*, quando todos os operativos do time
  clicam na mesma carta (o voto de cada um aparece na carta em tempo real), ou
  *clique livre*, quando o primeiro clique já revela.

Suporta de 2 a 8 jogadores. Cada time precisa de um mestre-espião e ao menos um
operativo para a partida começar.

## Tecnologias

| Componente | Escolha | Versão |
| --- | --- | --- |
| App desktop | Electron | 44.4.1 |
| Empacotamento | electron-builder | 26.15.3 |
| Interface | HTML, CSS e JavaScript (módulos ES), sem framework e sem build step | — |
| Servidor de salas | Node.js + `ws` | Node >= 20, `ws` 8.21.3 |
| Testes | `node --test` (nativo) | — |

Para desenvolver é preciso **Node.js 20 ou superior** (testado no 24.15.0) e
npm. Quem só vai *jogar* não instala nada disso: o `.exe` já leva tudo dentro.

Não há dependência de outro jogo do bundle, nem de arquivo compartilhado da
raiz. Tudo o que este jogo usa está dentro de `Codenames/`.

## Rodando em desenvolvimento

Todos os comandos rodam de dentro de `Codenames/`.

```bash
cd Codenames
npm install          # instala Electron, electron-builder e ws
npm run dev          # sobe o servidor local e abre 4 janelas do jogo
```

`npm run dev` existe para dar para testar uma partida inteira sozinho: ele sobe
o servidor em `localhost:8787` e abre quatro janelas — dois mestres e dois
operativos. Para abrir outra quantidade: `npm run dev -- 6`.

Outros comandos:

| Comando | O que faz |
| --- | --- |
| `npm start` | Abre uma janela do app, sem subir servidor |
| `npm run server` | Sobe só o servidor de salas (porta 8787, ou `PORT`) |
| `npm test` | Roda os testes de regra e o teste de integração |
| `npm run icone` | Regenera `build/icone.ico` a partir do desenho vetorial |
| `npm run fontes` | Rebaixa os `.woff2` e regenera `renderer/styles/fontes.css` |
| `npm run build` | Gera os `.exe` em `dist/` |

## Validação

```bash
npm test
```

São 18 testes em dois níveis:

- `shared/regras.test.js` — distribuição 9/8/7/1 do tabuleiro, validação da
  dica, cada transição de turno (acerto, adversário, neutra, assassino), as duas
  formas de vitória e o relógio.
- `server/integracao.test.js` — sobe o servidor de verdade, conecta jogadores
  por WebSocket e joga partidas inteiras: lobby, funções, consenso entre dois
  operativos, reconexão com crachá e recusa de crachá inválido. É onde se
  verifica que **o operativo nunca recebe as cores das cartas fechadas**.

## Gerando e usando o executável

```bash
npm run build
```

Sai em `dist/`, para **Windows x64**:

- `Palavras Secretas 1.0.0 (portatil).exe` — abre direto, sem instalar (~97 MB).
- `Palavras Secretas 1.0.0 (instalador).exe` — instalador NSIS, com atalho e
  escolha de pasta.

A distribuição leva o runtime do Electron, a interface, as fontes e as regras.
O jogador **não** precisa de Node, npm ou navegador. macOS e Linux não estão
configurados: o alvo combinado foi Windows.

O que o executável **não** leva é o servidor de salas — ele é um serviço
separado, e é o que permite que as pessoas joguem juntas. Veja a seguir.

## Rede e servidor de salas

O jogo é **online por natureza**: as partidas acontecem num servidor que guarda
o estado e distribui para todo mundo. Sem servidor no ar, o app abre mas não
conecta.

**Por que o servidor é autoritativo.** O tabuleiro completo, com as cores, só
existe no servidor. Cada jogador recebe uma projeção do estado feita sob medida
para ele: o operativo só sabe a cor de uma carta depois que ela vira. Se o
cliente recebesse tudo e a interface apenas escondesse as cores, bastaria abrir
o inspetor para ganhar todas as partidas. Num jogo de informação oculta isso não
é detalhe de implementação, é a regra principal.

O servidor guarda as salas **em memória** e não usa banco de dados. Uma partida
dura vinte minutos e não precisa sobreviver a um reinício.

### Subir o servidor

Local, para testar:

```bash
npm run server        # http://localhost:8787  — estado em /saude
```

Publicado, para jogar com quem está longe — duas opções:

**Render (gratuito, para uso contínuo).** O `render.yaml` desta pasta traz a
configuração pronta. Como o Render lê o arquivo na raiz do repositório, e as
regras do bundle não permitem criar arquivos fora da pasta do jogo, faça de um
destes jeitos: copie o `render.yaml` para a raiz do seu fork, ou crie o serviço
pelo painel usando os mesmos valores (*Root Directory* `Codenames`, Dockerfile
`server/Dockerfile`, health check `/saude`). O plano gratuito dorme depois de 15
minutos parado e leva uns 30 segundos para acordar — a tela inicial mostra
"conectando..." nesse intervalo.

**Túnel temporário (sem criar conta).** Para jogar hoje, rode o servidor na sua
máquina e exponha com `cloudflared tunnel --url http://localhost:8787`. O
comando devolve uma URL pública que vale enquanto ele estiver aberto.

### Apontar o app para o servidor

O endereço padrão é `ws://localhost:8787`, definido em
`renderer/js/config.js`. Cada jogador pode trocá-lo em **Configurar servidor**,
na tela inicial, e a escolha fica guardada na máquina dele — dá para começar num
túnel e migrar para o Render sem gerar um `.exe` novo. Use `ws://` para servidor
local e `wss://` para servidor publicado.

### Salas e reconexão

Salas têm código de 4 letras (sem I, O, 0, 1, U e V, que confundem na tela e na
hora de ditar). Quem cai volta para o mesmo lugar: o app guarda um crachá
(`jogadorId` + `token`) e reconecta sozinho, com espera crescente entre as
tentativas. A sala sobrevive 5 minutos sem ninguém conectado antes de ser
descartada.

## Como isto é testado sem o launcher central

O jogo é autossuficiente hoje: `npm run dev` sobe servidor e janelas, e
`npm test` valida regras e protocolo sem abrir interface nenhuma. Nada aqui
depende do futuro executável central nem de outro jogo do bundle.

## Pontos de entrada para a integração futura

Registrados aqui só como informação para quando o launcher for definido — nada
foi implementado neste sentido, conforme as regras da raiz.

| O quê | Onde |
| --- | --- |
| Processo principal do app | `electron/main.cjs` (lê `--janelas=N`) |
| Início da interface | `renderer/js/app.js` |
| Endereço do servidor | `renderer/js/config.js` (`SERVIDOR_PADRAO`) e ajuste por jogador na tela inicial |
| Servidor de salas | `server/index.js` — HTTP em `/saude`, WebSocket no mesmo endereço |
| Protocolo cliente/servidor | `shared/protocolo.js` |
| Regras do jogo (puras) | `shared/regras.js` |

Se o launcher precisar entrar numa sala direto, o caminho natural é passar
código de sala e nome por argumento de linha de comando para o `.exe` — ainda
não implementado.

## Pendências conhecidas

- Cadastro do responsável em `RESPONSAVEIS.md` — depende da revisão do Guilherme.
- Sem build para macOS e Linux.
- O `.exe` não é assinado digitalmente: o SmartScreen do Windows avisa na
  primeira execução.
- Sem áudio e sem placar histórico entre partidas.
- O servidor não tem limite de criação de salas; para uso em grupo fechado está
  de bom tamanho, mas não é um serviço público endurecido.

## Estrutura

```text
Codenames/
  electron/      processo principal e preload
  renderer/      interface (HTML, CSS, JS) e fontes embarcadas
  server/        servidor de salas (Node + ws) e Dockerfile
  shared/        regras, banco de palavras e protocolo (usados pelos dois lados)
  scripts/       ambiente de desenvolvimento, ícone e fontes
```

`shared/` é compartilhado **entre o cliente e o servidor deste jogo** — não é
código comum do bundle e nada fora desta pasta depende dele.
