# Instruções para agentes de IA — Metralhas Strike Block

## Identidade e escopo

| | |
| --- | --- |
| **Jogo** | Metralhas Strike Block |
| **Caminho autorizado** | `MetralhasStrikeBlock/` — e **nada** fora dela |
| **Responsável proposto** | Lucas — `@lukinhasbh98` |
| **Situação do cadastro** | **Pendente.** Primeiro PR de jogo novo, pela exceção do `AGENTS.md` da raiz. Guilherme (`@GuimaraesCRM`) cadastra em `RESPONSAVEIS.md` e aprova antes da integração. |

As regras do `AGENTS.md`, `CONTRIBUTING.md` e `RESPONSAVEIS.md` da raiz continuam valendo integralmente. Este arquivo **reafirma** aquelas regras e acrescenta o que é específico deste jogo; ele não pode enfraquecê-las nem ampliar o escopo de ninguém.

Em particular:

- Não editar, apagar, mover ou formatar arquivos de outros jogos (`Codenames/`, `Metralhopole/`) nem da raiz, `.github/`, regras de IA ou o cadastro de responsáveis.
- Não executar comandos que gravem fora desta pasta. `npm install`, `npm test` e `npm run build` gravam apenas em `MetralhasStrikeBlock/` (`node_modules/`, `renderer/vendor/`, `build/`, `dist/`) — confira antes de rodar qualquer outra ferramenta.
- Não implementar o launcher, o lobby central ou qualquer infraestrutura compartilhada aqui. A ponte de identidade descrita abaixo é o limite: ela **recebe** dados do launcher, não o constrói.
- Só um pedido explícito de Guilherme autoriza trabalho fora desta pasta, e vale apenas para a tarefa pedida.

## Comandos

```bash
cd MetralhasStrikeBlock
npm install          # obrigatório antes do primeiro start: copia o Three para renderer/vendor/
npm run dev          # servidor local + 2 janelas (npm run dev -- 4 abre 4)
npm start            # só o app
npm run server       # só o servidor de partidas (porta 8790, ou PORT)
npm test             # bateria completa — precisa passar antes de qualquer entrega
npm run build        # gera os .exe em dist/ (portátil e instalador, Windows x64)
```

## Como o código está organizado

- **`shared/`** — roda no cliente **e** no servidor. `protocolo.js` (nomes das mensagens), `constantes.js` (todos os números do jogo), `armas.js` (tabela e contas de dano), `mundo.js` (grade voxel, raycast DDA, colisão de caixa), `mapa.js` (gerador determinístico da arena e spawns), `fisica.js` (movimento e granadas), `regras.js` (rounds e economia, em funções puras).
- **`server/`** — `index.js` (WebSocket + `/saude` + salas + loop de 30 Hz), `sala.js` (lobby e reconexão), `partida.js` (simulação autoritativa: validação de posição, tiro, blocos, granadas, fases), `vistas.js` (o recorte do estado que cada jogador recebe).
- **`electron/`** — `main.cjs` (protocolo `app://`, janela), `preload.cjs` (ponte com sandbox), `identidade-launcher.cjs` (contrato do launcher).
- **`renderer/`** — interface e jogo. `simulacao-local.js` é o loop do cliente; `mundo/` tem cena, malha dos chunks, bonecos, arma em primeira pessoa e efeitos.

## Regras técnicas deste jogo

1. **A fronteira de autoridade é sagrada.** O cliente reporta a própria posição; **tudo que decide o round — dano, morte, munição, dinheiro, compras, blocos, granadas — é decidido no servidor**. Nunca mova uma dessas decisões para o cliente "para ficar mais responsivo": o jeito certo é o cliente prever e o servidor corrigir.
2. **Regra de jogo nova vai em `shared/regras.js`, como função pura**, com teste. O servidor chama; ele não deve ganhar lógica de regra embutida.
3. **Número de balanceamento vai em `shared/armas.js` ou `shared/constantes.js`**, nunca espalhado pelo código. Cliente e servidor precisam ler o mesmo valor — preço divergente vira dinheiro de graça ou compra impossível.
4. **Geometria e física ficam em `shared/`.** O tiro que o servidor valida tem de atravessar exatamente os mesmos blocos que o cliente desenhou; duplicar essa matemática é criar divergência.
5. **O mapa não trafega.** Ele é gerado por `gerarArena()` nos dois lados. Se mexer no gerador, mexeu para todo mundo — e o teste que garante que nenhum spawn enxerga um spawn inimigo precisa continuar passando.
6. **Sem bundler, sem framework, sem CDN.** Módulos ES servidos pelo protocolo `app://` (em `file://` o Chromium recusa módulos ES e trata o `localStorage` como origem nula). Dependência de front nova é copiada para `renderer/vendor/` por `scripts/vendor.cjs`.
7. **Nenhum asset binário.** Som é WebAudio sintetizado, modelo é caixa colorida, ícone sai de um SVG no script de build. Isso é decisão de projeto, não falta de tempo.
8. **Segurança da janela não se afrouxa**: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, CSP sem script remoto e sem `eval`, links externos no navegador do sistema.
9. **O contrato do launcher mora em dois arquivos** — `electron/identidade-launcher.cjs` e `renderer/js/launcher.js`. Mudou o contrato? Mexa só neles e atualize o teste. Nada mais do jogo deve saber de onde vem a identidade do jogador.
10. **Mensagem nova no protocolo entra em `shared/protocolo.js`** antes de ser usada dos dois lados — nunca com a string digitada à mão no cliente e no servidor.

## Antes de dizer que terminou

1. `npm test` passando (43 testes na última verificação).
2. Se mexeu na interface ou no fluxo de partida, rode `npm run dev` e jogue de verdade em duas janelas: criar sala, entrar, times, comprar, atirar, construir, morrer, round virar.
3. Se mexeu no empacotamento, `npm run build` e abra o `.exe` de `dist/`.
4. Confira o diff inteiro: `git status --short` e `git diff`. **Todo caminho tem de começar com `MetralhasStrikeBlock/`.**
5. Adicione só esta pasta: `git add -- MetralhasStrikeBlock/`. **Nunca `git add .`** — há trabalho de outras pessoas no repositório.
6. Revise o que entrou: `git diff --cached --name-only`.
7. Publique a branch e abra o PR. A integração em `main` depende da aprovação explícita de Guilherme (`@GuimaraesCRM`); não faça merge nem aprove em nome dele.
8. Não use force push, não reescreva histórico compartilhado, não faça commit de `node_modules/`, `dist/`, `build/`, `renderer/vendor/` ou credenciais.
