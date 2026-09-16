# Codenames — Metralhas Secretos

Jogo de dedução por associação de palavras no estilo Codenames, em português,
para o grupo jogar junto pela internet. Aplicativo desktop para Windows: cada
pessoa abre o `.exe`, digita o nome, entra numa sala por código de 4 letras e
joga com o tabuleiro atualizando em tempo real para todo mundo.

| | |
| --- | --- |
| **Jogo** | Codenames (nome do app: Metralhas Secretos) |
| **Pasta** | `Codenames/` |
| **Responsável proposto** | @lukinhasbh98 |
| **Situação do cadastro** | **Pendente** — primeiro PR de jogo novo, conforme a exceção do `AGENTS.md` da raiz. O cadastro em `RESPONSAVEIS.md` é feito pelo Guilherme (@GuimaraesCRM) na revisão. |
| **Estado** | Jogável de ponta a ponta e empacotado. Partida completa, reconexão, placar, relógio e fim de jogo funcionando. |

## Como se joga

Vinte e cinco cartas com palavras, num grid 5x5. Dois times, vermelho e azul.
Cada time tem um **Metralha Espião**, que enxerga a cor secreta de cada carta, e
um ou mais **Metralhas Operadores**, que veem o tabuleiro fechado.

- O time que começa tem **9** cartas; o outro, **8**. Há **7** neutras e **1**
  assassino.
- Na sua vez, o Metralha Espião diz **uma palavra e um número** ("FRUTA 3"),
  ligando a dica a cartas do próprio time.
- Os Metralhas Operadores discutem e escolhem cartas, uma de cada vez. A dica de N
  dá **N+1** palpites.
- Carta do próprio time: continua. Carta do adversário ou neutra: passa a vez.
  **Assassino: derrota imediata.**
- Vence quem revelar todas as próprias cartas primeiro.

Duas opções ajustáveis na sala:

- **Tempo por turno** — sem tempo, 60s, 90s, 120s ou um valor livre entre 15 e
  900 segundos. O anfitrião pode mudar durante a partida; vale do próximo turno
  em diante (desligar o relógio vale na hora).
- **Como a carta vira** — *por consenso*, quando todos os Metralhas Operadores do time
  clicam na mesma carta (o voto de cada um aparece na carta em tempo real), ou
  *clique livre*, quando o primeiro clique já revela.

Suporta de 2 a 8 jogadores. Cada time precisa de um **Metralha Espião** e ao
menos um **Metralha Operador** para a partida começar.

**Espectador.** Quem não quer jogar clica em *Só assistir* no lobby: vê o
tabuleiro fechado, acompanha as dicas e os votos, e não conta para o começo da
partida. Quem entra na sala com a partida já rolando também vira espectador
automaticamente, em vez de ficar de fora até a próxima.

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
o servidor em `localhost:8787` e abre quatro janelas — dois Metralhas Espiões e dois
Metralhas Operadores. Para abrir outra quantidade: `npm run dev -- 6`.

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

São 27 testes em três níveis:

- `shared/regras.test.js` — distribuição 9/8/7/1 do tabuleiro, validação da
  dica, cada transição de turno (acerto, adversário, neutra, assassino), as duas
  formas de vitória e o relógio.
- `electron/identidade-launcher.test.cjs` — as formas de receber a identidade do
  launcher, a prioridade entre elas, e o que acontece com um pacote ilegível
  (cai no fluxo manual em vez de quebrar a abertura do jogo).
- `server/integracao.test.js` — sobe o servidor de verdade, conecta jogadores
  por WebSocket e joga partidas inteiras: lobby, funções, consenso entre dois
  Metralhas Operadores, espectadores, reconexão com crachá e recusa de crachá
  inválido. É onde se verifica que **nem o Metralha Operador nem o espectador
  recebem as cores das cartas fechadas**.

## Gerando e usando o executável

```bash
npm run build
```

Sai em `dist/`, para **Windows x64**:

- `Metralhas Secretos 1.0.0 (portatil).exe` — abre direto, sem instalar (~97 MB).
- `Metralhas Secretos 1.0.0 (instalador).exe` — instalador NSIS, com atalho e
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
para ele: o Metralha Operador só sabe a cor de uma carta depois que ela vira. Se o
cliente recebesse tudo e a interface apenas escondesse as cores, bastaria abrir
o inspetor para ganhar todas as partidas. Num jogo de informação oculta isso não
é detalhe de implementação, é a regra principal.

O servidor guarda as salas **em memória** e não usa banco de dados. Uma partida
dura vinte minutos e não precisa sobreviver a um reinício.

### Subir o servidor

Na sua máquina, para testar:

```bash
npm run server        # http://localhost:8787 — estado em /saude
```

#### Num servidor Linux

É o caminho recomendado para o grupo: o servidor fica de pé o tempo todo e todo
mundo conecta de onde estiver. Precisa de **Node 20 ou superior** (ou Docker) e
de uma porta liberada. Escolha uma das duas formas.

**A. Docker**

Copie a pasta `Codenames/` para o servidor e rode, de dentro dela:

```bash
docker build -f server/Dockerfile -t metralhas-secretos-servidor .
docker run -d --name metralhas-secretos --restart unless-stopped   -p 8787:8787 metralhas-secretos-servidor
```

A imagem leva só o Node, o `ws`, `server/` e `shared/` — nada do Electron nem da
interface, que vivem no `.exe` de cada jogador.

**B. Node direto, com systemd**

```bash
sudo mkdir -p /opt/metralhas-secretos
# copie a pasta Codenames/ para /opt/metralhas-secretos (rsync, scp ou git clone)
cd /opt/metralhas-secretos
npm install --omit=dev          # instala apenas o ws

sudo useradd --system --no-create-home metralhas
sudo chown -R palavras: /opt/metralhas-secretos
sudo cp server/metralhas-secretos.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now metralhas-secretos
```

O arquivo `server/metralhas-secretos.service` é um modelo pronto; ajuste `User`,
`WorkingDirectory` e `PORT` se o seu caminho for outro.

**Conferindo e liberando a porta**

```bash
curl http://localhost:8787/saude     # {"servico":"metralhas-secretos",...}
sudo ufw allow 8787/tcp              # se usar ufw
```

Os jogadores apontam o app para `ws://SEU.IP.OU.DOMINIO:8787`. Isso já basta
para jogar — o app aceita `ws://` para qualquer endereço, não só localhost.

**TLS, se quiser (recomendado, não obrigatório)**

Sem TLS o tráfego da partida anda em texto puro. Com um domínio apontando para o
servidor, o [Caddy](https://caddyserver.com) resolve certificado e *upgrade* de
WebSocket sozinho:

```caddyfile
jogo.seudominio.com {
    reverse_proxy localhost:8787
}
```

O endereço passa a ser `wss://jogo.seudominio.com`, sem porta. Com nginx,
lembre-se dos cabeçalhos `Upgrade` e `Connection` no `location` do proxy — sem
eles o WebSocket não sobe.

#### Alternativas sem servidor próprio

**Render (plano gratuito).** O `render.yaml` desta pasta traz a configuração
pronta. Como o Render lê o arquivo na raiz do repositório, e as regras do bundle
não permitem criar arquivos fora da pasta do jogo, faça de um destes jeitos:
copie o `render.yaml` para a raiz do seu fork, ou crie o serviço pelo painel
usando os mesmos valores (*Root Directory* `Codenames`, Dockerfile
`server/Dockerfile`, health check `/saude`). O plano gratuito dorme depois de 15
minutos parado e leva uns 30 segundos para acordar — a tela inicial mostra
"conectando..." nesse intervalo.

**Túnel temporário (sem criar conta).** Para jogar hoje, rode o servidor na sua
máquina e exponha com `cloudflared tunnel --url http://localhost:8787`. O
comando devolve uma URL pública que vale enquanto ele estiver aberto.

### Apontar o app para o servidor

O endereço padrão é `ws://localhost:8787`, definido em
`renderer/js/config.js`. Cada jogador troca o endereço em **Configurar
servidor**, na tela inicial, e a escolha fica guardada na máquina dele — dá para
começar num túnel e migrar para um servidor próprio sem gerar `.exe` novo.

Use `ws://` para servidor sem TLS (inclusive um IP público) e `wss://` quando
houver certificado. Se o grupo for fixo, vale trocar o `SERVIDOR_PADRAO` em
`renderer/js/config.js` antes de gerar o `.exe`: aí ninguém precisa configurar
nada, é só abrir e jogar.

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

## Identidade do jogador e a ponte com o launcher

Hoje o jogo pergunta o nome e lembra dele na próxima vez. Quando o launcher dos
Jogos Metralhas existir, é ele quem vai saber o apelido e a foto de quem está
jogando, e o jogo não deveria perguntar de novo.

O contrato final ainda não está definido — então a ponte já existe, aceita as
três formas mais prováveis e fica pronta para ser trocada:

```bash
# 1. argumentos de linha de comando
"Metralhas Secretos.exe" --jogador-nome="Lucas" --jogador-avatar="https://..." --sala=ABCD

# 2. variáveis de ambiente (não aparecem na lista de processos)
METRALHAS_JOGADOR_NOME=Lucas METRALHAS_JOGADOR_AVATAR=https://... METRALHAS_SALA=ABCD

# 3. um pacote único em base64, para quando houver mais campos
"Metralhas Secretos.exe" --jogador=<base64 de {"nome":"...","avatar":"...","sala":"..."}>
```

Com o nome vindo de fora, a tela inicial deixa de pedir o nome e passa a mostrar
quem você é. Com `sala` preenchida, o jogo entra na sala sozinho assim que
conecta.

**Para trocar o contrato, mexa em dois arquivos e em mais nenhum:**

| Arquivo | Papel |
| --- | --- |
| `electron/identidade-launcher.cjs` | lê argumentos, ambiente e pacote; tem testes próprios |
| `renderer/js/launcher.js` | decide entre a identidade de fora e a digitada, e limpa o que chega |

O avatar é validado antes de entrar na tela: aceita `https:` e `data:image/...`
e recusa o resto. Um endereço quebrado cai de volta nas iniciais, sem ícone de
imagem partida no meio da lista.

## Pontos de entrada para a integração futura

Registrados aqui só como informação para quando o launcher for definido — fora a
ponte de identidade acima, nada foi implementado neste sentido, conforme as
regras da raiz.

| O quê | Onde |
| --- | --- |
| Processo principal do app | `electron/main.cjs` (lê `--janelas=N`) |
| Início da interface | `renderer/js/app.js` |
| Endereço do servidor | `renderer/js/config.js` (`SERVIDOR_PADRAO`) e ajuste por jogador na tela inicial |
| Servidor de salas | `server/index.js` — HTTP em `/saude`, WebSocket no mesmo endereço |
| Identidade vinda do launcher | `electron/identidade-launcher.cjs` e `renderer/js/launcher.js` |
| Protocolo cliente/servidor | `shared/protocolo.js` |
| Regras do jogo (puras) | `shared/regras.js` |

Entrar numa sala direto pelo launcher já funciona, pela ponte descrita acima.

## Pendências conhecidas

- Cadastro do responsável em `RESPONSAVEIS.md` — depende da revisão do Guilherme.
- Sem build para macOS e Linux.
- O `.exe` não é assinado digitalmente: o SmartScreen do Windows avisa na
  primeira execução.
- Sem áudio e sem placar histórico entre partidas.
- O servidor tem teto de salas simultâneas e limite de tamanho de mensagem, mas
  não tem autenticação nem limite por IP: é feito para um grupo fechado, não
  para ser um serviço público aberto.

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
