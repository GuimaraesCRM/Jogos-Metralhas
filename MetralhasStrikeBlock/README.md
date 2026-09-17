# Metralhas Strike Block

FPS multiplayer numa arena de blocos: **Time Azul contra Time Vermelho**, em rounds no estilo Counter-Strike — fase de compra, combate, e quem morre assiste até o round acabar. Dinheiro por abate e por round vencido, menu de compra com pistolas, shotguns, submetralhadoras, rifles e snipers, e blocos que você compra, coloca e destrói no meio do tiroteio.

| | |
| --- | --- |
| **Jogo / pasta** | Metralhas Strike Block — `MetralhasStrikeBlock/` |
| **Responsável proposto** | Lucas — `@lukinhasbh98` |
| **Situação do cadastro** | **Pendente.** Primeiro PR de jogo novo, conforme a exceção do `AGENTS.md` da raiz. O cadastro em `RESPONSAVEIS.md` é feito por Guilherme (`@GuimaraesCRM`) na revisão. |
| **Estado** | Jogável de ponta a ponta: partida completa, economia, blocos, granadas e executável Windows. |

---

## Como se joga

Dois times de até 8 jogadores disputam **rounds**. Vence a partida quem chegar primeiro a **8 rounds**; no round 7 os times **trocam de lado** e a economia zera.

Cada round tem três fases:

| Fase | Duração | O que acontece |
| --- | --- | --- |
| **Compra** (freeze) | 15 s (ajustável) | Todo mundo fica preso na própria base. Abra a loja com **B** e gaste o dinheiro. |
| **Combate** | 105 s (ajustável) | Os portões liberam. Quem morre vira espectador até o fim do round. |
| **Pós-round** | 5 s | Resultado na tela, economia paga, blocos de jogador somem. |

O **dono da sala escolhe os tempos** de compra e de combate no lobby, antes de iniciar.

O round acaba quando um time é **eliminado**. Se o tempo estourar, **vence quem tiver mais jogadores vivos** — empatou em número de vivos, é empate: ninguém pontua e os dois lados recebem o dinheiro de derrota. Sem bomba para plantar, premiar quem preservou gente é o que impede o time em desvantagem de simplesmente esperar o relógio.

Sobreviveu ao round? Mantém a arma e o colete, e recebe munição cheia. Morreu? Volta com a pistola inicial.

### Economia

| Evento | Dinheiro |
| --- | --- |
| Início (e após a troca de lado) | $800 |
| Round vencido | +$3.000 |
| Round perdido ou empatado | +$1.900 |
| Abate | $100 a $1.500, conforme a arma |
| Teto | $10.000 |

Armas fracas pagam mais por abate: matar de shotgun rende $900 e de marreta $1.500, enquanto a AWB paga só $100. É o que dá chance de virada para quem está sem dinheiro.

### Teclas

| Tecla | Ação |
| --- | --- |
| **WASD** | Andar |
| **Espaço** | Pular — pule e olhe para baixo colocando blocos para levantar uma torre |
| **Ctrl** ou **C** | Agachar (mais devagar, mira mais firme, silhueta menor) |
| **Clique esquerdo** | Atirar |
| **Clique direito** | Mirar — vale para **todas** as armas: a arma sobe até a linha do olho, a mira fecha e o tiro fica mais preciso |
| **R** | Recarregar |
| **1 / 2 / 3** | Arma primária / pistola / marreta |
| **4** | Modo bloco (clique coloca um bloco) |
| **G** | Granada |
| **B** | Abrir e fechar a loja |
| **TAB** | Placar |
| **E** | Trocar de aliado observado (quando morto) |
| **ESC** | Soltar o mouse (abre o menu de pausa) |
| **F11** | Tela cheia |

### Arsenal

Todos os preços, danos e cadências ficam em [`shared/armas.js`](shared/armas.js) — cliente e servidor leem a mesma tabela.

| Arma | Categoria | Preço | Dano | Cadência | $/abate |
| --- | --- | ---: | ---: | ---: | ---: |
| PM-9 *(inicial, grátis)* | Pistola | $0 | 26 | 400 RPM | $300 |
| Magnum Bloco | Pistola | $700 | 55 | 150 RPM | $300 |
| Cano Curto | Shotgun | $1.100 | 9 × 8 pellets | 68 RPM | $900 |
| Repetidora | Shotgun | $2.000 | 8 × 6 pellets | 210 RPM | $900 |
| MP-Bloco | Submetralhadora | $1.250 | 18 | 750 RPM | $600 |
| Metralhinha | Submetralhadora | $1.700 | 22 | 800 RPM | $600 |
| Tribloco *(rajada de 3)* | Rifle | $2.050 | 30 | 500 RPM | $300 |
| MC-47 | Rifle | $2.700 | 34 | 600 RPM | $300 |
| MB-4 | Rifle | $3.100 | 30 | 660 RPM | $300 |
| Luneta Leve | Sniper | $1.700 | 74 | 48 RPM | $300 |
| AWB | Sniper | $4.750 | 115 | 41 RPM | $100 |

Equipamento: **Colete** $650 · **Colete + Capacete** $1.000 · **Granada HE** $300 (máx. 2) · **Pacote de 10 blocos** $250 (até **100** carregados). A **Marreta** é de graça e fica sempre no slot 3.

Headshot multiplica o dano (×4 em rifles, pistolas e snipers); o capacete corta esse multiplicador para ×2. O colete absorve 40% do dano no corpo e vai se gastando. Shotguns perdem dano com a distância. A MC-47 mata de um tiro na cabeça sem capacete; a AWB mata de um tiro no corpo.

### Recuo e mira

**Segurar o gatilho apontando para o mesmo lugar não funciona.** O recuo é um padrão fixo de spray, no formato de T invertido do CS: os primeiros tiros sobem quase retos, o meio do pente puxa forte para um lado e depois vira para o outro. Um spray de 10 tiros da MC-47 sobe cerca de **21 graus** — a mira sai mesmo do lugar, e a bala vai junto.

A mira **só começa a voltar depois que você solta o gatilho**. Durante a rajada o recuo acumula, que é o que faz o padrão existir: se ela se recuperasse enquanto você atira, tudo saturaria em dois graus e a mira ficaria praticamente cravada no centro.

Como o padrão é fixo, ele é decorável — e é decorando que se aprende a compensar puxando o mouse no caminho contrário. Quem não decorou leva mais vantagem dando tapinhas de 2 ou 3 tiros.

Cada arma tem o próprio coice: a MC-47 é forte e difícil de segurar, a MB-4 é mais fraca mas bem mais controlável, a AWB dá um coice enorme (e não importa, porque você vai atirar uma vez). **Mirar com o botão direito** sobe a arma até a linha do olho, alinha a mira de ferro (ou a luneta) com o centro da tela, fecha o cone de tiro e segura um pouco o recuo. Andar, e principalmente pular, espalha o tiro de qualquer arma.

A mira na tela mostra o cone real: ela abre quando você corre e durante o spray, e fecha quando você para. Se a mira está aberta, seu tiro vai espalhar de verdade — ela não mente para você.

### Blocos

Compre um pacote na loja, aperte **4** e clique para levantar cobertura: uma parede para atravessar o campo aberto, degraus para alcançar a torre central, um bloqueio no portão do inimigo. Dá para carregar **até 100 blocos**, o suficiente para uma torre — pule e coloque um bloco embaixo de si mesmo para subir. Blocos de jogador têm 60 de vida e são destruídos a tiro (a shotgun derruba rápido) ou com **2 golpes de marreta**. O mapa base é indestrutível, e todo bloco colocado some no fim do round.

### O mapa

Arena de 64×64 blocos gerada por código em [`shared/mapa.js`](shared/mapa.js): base azul a oeste, base vermelha a leste, cada uma com dois portões em alturas de campo diferentes — **nenhum ponto de nascimento enxerga um ponto de nascimento inimigo** (há um teste que garante isso). No meio: corredor central com caixas, muretas de flanco para agachar, paredes quebra-visão e uma torre de 5 blocos com escada pelo lado sul — a melhor posição de sniper do mapa, e a mais exposta na hora de subir.

---

## Tecnologias

| Componente | Escolha | Versão |
| --- | --- | --- |
| Aplicativo desktop | Electron | ^44.4.1 |
| Empacotamento | electron-builder | ^26.15.3 |
| Renderização 3D | Three.js | ^0.170 |
| Rede | WebSocket (`ws`) | ^8.21.3 |
| Servidor | Node.js | ≥ 20 (imagem Docker usa 22) |
| Interface | HTML/CSS/JS nativo, módulos ES, **sem bundler e sem framework** | — |
| Testes | `node --test` (runner nativo) | — |

**Zero assets binários no repositório.** Os sons são sintetizados em tempo real com WebAudio (ruído filtrado + osciladores), os modelos são caixas coloridas, e o ícone do `.exe` é gerado a partir de um SVG escrito no próprio script de build.

---

## Rodando em desenvolvimento

Pré-requisitos: **Node.js 20 ou superior** e npm. Nada mais.

```bash
cd MetralhasStrikeBlock
npm install          # instala e copia o Three para renderer/vendor/
npm run dev          # servidor local + 2 janelas do jogo
npm run dev -- 4     # 4 janelas, para testar 2×2 sozinho
```

O `npm run dev` sobe o servidor na porta **8790** e abre as janelas já apontando para `ws://localhost:8790`. Numa janela clique **Criar sala**, anote o código de 4 letras, e nas outras entre com esse código. Escolha os times, o anfitrião inicia.

Outros comandos:

```bash
npm start            # só o app (conecta no servidor que você indicar na tela)
npm run server       # só o servidor de partidas
npm run estudio      # estúdio de modelos (veja abaixo)
npm test             # toda a bateria de testes
npm run vendor       # recopia o Three para renderer/vendor/ (o npm install já faz)
```

### Estúdio de modelos

`npm run estudio` abre uma tela de desenvolvimento que mostra o boneco e todas as armas fora da partida: dá para girar em volta, alternar entre andando/agachado/mirando, trocar de arma e disparar (espaço), recarregar (R) e golpear com a marreta (F). É onde se ajusta proporção, cor e pose sem precisar entrar num jogo e correr até o inimigo.

> `npm install` é obrigatório antes do primeiro `npm start`: o Three.js é copiado de `node_modules` para `renderer/vendor/` pelo script `postinstall`. Essa pasta é derivada e não vai para o Git.

## Validação

```bash
npm test
```

São **43 testes** em quatro frentes:

- `shared/fisica.test.js` — gravidade, pulo, colisão, e a garantia de que ninguém atravessa parede nem com `dt` grande.
- `shared/mapa.test.js` — o mapa é determinístico, os spawns nascem em chão firme dentro da própria base, e **nenhum spawn tem linha de visão para um spawn inimigo**.
- `shared/armas.test.js` — a tabela inteira e as contas de dano (headshot, capacete, colete, queda de dano da shotgun).
- `shared/regras.test.js` — economia, compras, fim de round por eliminação e por tempo, troca de lado, o que se perde ao morrer.
- `server/integracao.test.js` — o motor da partida com relógio sintético (compra, tiro que mata, tiro que **não** atravessa muro, round fechando) **e o servidor de verdade por WebSocket**: criar sala, entrar, escolher time, iniciar, e a rejeição de teleporte.
- `electron/identidade-launcher.test.cjs` — o contrato da ponte com o launcher.

---

## Gerando e usando o executável

```bash
npm run build
```

Sai em `dist/`, para **Windows x64**:

- `Metralhas Strike Block 0.1.0 (portatil).exe` — arquivo único, abre direto, não instala nada.
- `Metralhas Strike Block 0.1.0 (instalador).exe` — instalador com escolha de pasta e atalho na área de trabalho.

O executável leva tudo que o jogador precisa (runtime, interface, Three.js). **Não é preciso ter Node, npm ou qualquer ferramenta de desenvolvimento para jogar.** O `.exe` é o cliente; para jogar em grupo alguém precisa subir o servidor (próxima seção).

**Pendência conhecida:** a distribuição não é assinada digitalmente. O Windows SmartScreen vai mostrar "Windows protegeu o computador" na primeira execução — é preciso clicar em *Mais informações* → *Executar assim mesmo*. Assinar exige um certificado pago.

---

## Servidor: rede e como subir no Linux

O servidor é **autoritativo**: ele decide dano, morte, dinheiro, compras, blocos e granadas. O cliente manda a própria posição (para o movimento responder sem latência) e o servidor valida — deslocamento máximo por intervalo, ninguém dentro de parede, ninguém fora da base durante o freeze. Posição recusada volta corrigida.

- Protocolo: **WebSocket**, mensagens JSON. Porta padrão **8790** (`PORT` no ambiente).
- Loop de simulação a **30 Hz**; fotos do estado para os clientes a **20 Hz**.
- Health check HTTP em **`/saude`** (as hospedagens gratuitas exigem uma resposta HTTP comum para considerar o serviço no ar).
- Salas em memória, sem banco de dados. Sala vazia é descartada após 5 minutos; teto de 100 salas simultâneas.
- O mapa **não trafega**: cliente e servidor geram o mesmo mundo por código. Só os blocos colocados por jogadores são sincronizados.

Rodando local (mesma máquina ou LAN):

```bash
npm run server                 # porta 8790
PORT=9000 npm run server       # outra porta
```

Na LAN, os outros jogadores digitam `ws://SEU-IP-LOCAL:8790` no campo *Servidor* da tela inicial. Pela internet é preciso um servidor acessível (VPS, túnel ou hospedagem) — abaixo as três formas prontas, todas **rodando em Linux**.

### Docker

```bash
cd MetralhasStrikeBlock
docker build -f server/Dockerfile -t metralhas-strike-block .
docker run -p 8790:8790 metralhas-strike-block
```

A imagem é `node:22-alpine` e copia só `shared/` e `server/` — o cliente Electron não entra nela.

### systemd

O modelo está em [`server/metralhas-strike-block.service`](server/metralhas-strike-block.service), com as instruções no cabeçalho do arquivo. Ele já vem com `NoNewPrivileges`, `ProtectSystem=strict` e `ProtectHome` — o servidor só precisa ler os próprios arquivos e abrir uma porta.

### Render (plano gratuito)

O modelo está em [`render.yaml`](render.yaml). O Render procura esse arquivo na raiz do repositório e as regras do bundle não permitem criar arquivos fora da pasta do jogo, então copie-o para a raiz do seu fork ou crie o serviço pelo painel com os mesmos valores (*Root Directory*: `MetralhasStrikeBlock`, *Dockerfile*: `server/Dockerfile`, *Health Check*: `/saude`).

> O plano gratuito hiberna depois de um tempo parado e leva ~1 minuto para acordar. Para um FPS, um servidor sempre ligado e com ping baixo joga muito melhor.

Com TLS (`wss://`), o endereço na tela inicial vira `wss://seu-dominio` sem porta.

### Reconexão

Quem cai volta: o app guarda um crachá (sala + id + token) no `localStorage` e tenta reconectar sozinho, com o lugar preservado na partida em andamento. Durante o lobby, quem sai libera a vaga.

---

## Identidade do jogador e a ponte com o launcher

Hoje o jogador digita o nome na tela inicial. **Quando o launcher do bundle existir, o nome e a foto virão dele** — a ponte já está pronta e testada, esperando só o launcher do outro lado.

O jogo aceita a identidade de três formas e ignora o que não reconhece:

```bash
# 1. argumentos de linha de comando (como um launcher normalmente abre um jogo)
"Metralhas Strike Block.exe" --jogador-nome="Lucas" --jogador-avatar="https://…/foto.png" --sala=ABCD

# 2. variáveis de ambiente (quando o launcher prefere não expor dados na lista de processos)
METRALHAS_JOGADOR_NOME  METRALHAS_JOGADOR_AVATAR  METRALHAS_SALA

# 3. um pacote único em base64, para quando o contrato tiver mais campos
"Metralhas Strike Block.exe" --jogador=<base64 de {"nome":"…","avatar":"…","sala":"…"}>
```

Prioridade: **argumento → ambiente → pacote**. Quando o nome vem de fora, o campo na tela inicial aparece preenchido e **travado**, com a foto ao lado; se vier também uma `sala`, o jogo entra nela direto. Pacote ilegível não derruba nada: cai no fluxo normal de digitar o nome.

O contrato está isolado em **dois arquivos** — [`electron/identidade-launcher.cjs`](electron/identidade-launcher.cjs) (lê) e [`renderer/js/launcher.js`](renderer/js/launcher.js) (usa). Quando o contrato do bundle for definido, mexer neles dois basta; nada mais do jogo sabe de onde vem a identidade.

### Pontos de entrada para a integração futura

| O quê | Onde | Observação |
| --- | --- | --- |
| Processo principal do app | `electron/main.cjs` | Lê `--janelas=N`; o launcher pode abrir o `.exe` como processo independente. |
| Identidade (nome, foto, sala) | `electron/identidade-launcher.cjs` | Contrato descrito acima, com teste próprio. |
| Início da interface | `renderer/js/app.js` | Máquina de telas: inicial → lobby → jogo → fim. |
| Endereço do servidor | `renderer/js/config.js` | `SERVIDOR_PADRAO`; o jogador pode trocar na tela inicial. |
| Servidor de partidas | `server/index.js` | Processo separado, com `/saude` para o launcher checar se está no ar. |
| Vocabulário do protocolo | `shared/protocolo.js` | Nomes de todas as mensagens. |
| Regras e economia | `shared/regras.js` | Funções puras, sem rede. |

Nada de launcher, lobby central ou infraestrutura compartilhada foi implementado aqui — conforme o `AGENTS.md` da raiz, isso é tarefa própria de Guilherme.

---

## Como isto é testado sem o launcher central

O jogo é autossuficiente: `npm run dev` sobe servidor e janelas, `npm test` cobre regras, física, mapa, servidor real e a ponte do launcher, e `npm run build` gera o `.exe` que roda sem nenhuma ferramenta de desenvolvimento instalada. Não há dependência de outro jogo do bundle nem de arquivo fora desta pasta.

---

## Como o código está organizado

```text
MetralhasStrikeBlock/
├── electron/     processo principal, preload e a ponte do launcher
├── renderer/     a interface e o jogo em si
│   ├── styles/   CSS
│   ├── vendor/   Three.js copiado de node_modules (não versionado)
│   └── js/
│       ├── app.js              telas e conexão
│       ├── simulacao-local.js  o loop do jogo no cliente
│       ├── entrada.js hud.js menu-compra.js audio.js
│       ├── mundo/  cena, malha dos chunks, bonecos, arma FPS, efeitos
│       └── telas/  inicial, lobby, fim
├── shared/       usado pelos DOIS lados: protocolo, armas, mundo, mapa, física, regras
├── server/       servidor autoritativo + Docker + systemd
└── scripts/      ambiente de dev, cópia do Three, gerador de ícone
```

O que vive em `shared/` roda igual nos dois lados — é isso que faz o tiro que o servidor valida atravessar exatamente os mesmos blocos que o cliente desenhou.

---

## Limitações conhecidas

- **Sem compensação de lag.** O servidor resolve o tiro na posição atual que ele conhece, e o cliente desenha os outros jogadores ~100 ms no passado (interpolação). Com ping baixo, como o de amigos na mesma região, é imperceptível; acima de ~120 ms é preciso mirar um pouco à frente.
- **Movimento é reportado pelo cliente.** O servidor valida velocidade, colisão e zona, mas a posição em si vem de fora. Entre amigos não é problema — e tudo que decide o round (dano, morte, dinheiro, blocos) é decidido pelo servidor.
- **Snapshots em JSON a 20 Hz**: folgado para os 16 jogadores do teto, não pensado para dezenas.
- **O `.exe` não é assinado** (SmartScreen avisa na primeira execução).
- **Sem fogo amigo**: o tiro para no aliado, mas não machuca.

---

## Roadmap — ideias para deixar mais divertido

Nada disto está implementado; é a lista de para onde o jogo pode crescer.

1. **Modo bomba / desarme** na torre central — dá um objetivo ao round e resolve o empate por tempo de forma clássica.
2. **Facão** com abate premiado e movimento mais rápido com ele na mão.
3. **Granadas de fumaça e flash** — fumaça como nuvem de voxels semitransparentes, aproveitando o mundo em blocos.
4. **Largar a arma ao morrer** e poder pegar a do chão.
5. **Som 3D de verdade** (PannerNode com HRTF) e passos que denunciam a posição do inimigo.
6. **Bots simples** para treinar e para completar time quando faltar gente.
7. **Skins de bloco e cores de time**, mais estatísticas persistentes (K/D, precisão) vindas do launcher.
8. **Sequências de abate** com recompensas cosméticas.
9. **Mais mapas** (outro gerador) com votação no lobby.
10. **Modo mata-mata com respawn** para aquecer enquanto a sala enche.
11. Compensação de lag rebobinando as caixas de acerto, e snapshots binários, se algum dia a partida crescer.

---

## Cadastro pendente

Este é o primeiro PR deste jogo, aberto pela exceção descrita no `AGENTS.md` da raiz: o jogo, a pasta e o autor proposto (**Lucas — `@lukinhasbh98`**) estão registrados aqui e no `AGENTS.md` local, e **Guilherme (`@GuimaraesCRM`) faz o cadastro em `RESPONSAVEIS.md` e aprova o PR antes da integração**. Nenhum arquivo fora de `MetralhasStrikeBlock/` foi criado ou alterado.
