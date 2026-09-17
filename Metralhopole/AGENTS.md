# Metralhopole

Migração em andamento: a nova camada visual deve ser desenvolvida em Godot 4 dentro de `godot/`, com tabuleiro, peões, construções e dados no mesmo mundo 3D. A versão Electron permanece como referência funcional até a integração das regras e do multiplayer. Não simular 3D por sobreposição de HTML nessa nova camada.

Responsável proposto: Guilherme Guimarães, `@GuimaraesCRM`. Cadastro pendente de revisão do primeiro PR.

Escopo: somente `Metralhopole/`. As regras do `AGENTS.md` da raiz continuam válidas. Não editar outros jogos, cadastro de responsáveis ou infraestrutura compartilhada.

Jogo de propriedades simplificado, online para 2 a 8 pessoas, com tabuleiro em perspectiva 3D. Aplicativo desktop Electron, distribuído como `.exe` para Windows, sem exigir navegador ou Node.js do jogador. Node.js 22+ é necessário apenas para desenvolvimento ou servidor dedicado. Execute `npm start` para iniciar, `npm test` para validar e `npm run build` para gerar o executável. Estado e decisões da partida pertencem ao servidor. Nunca aceite saldo, posição, resultado de dados ou identidade do jogador informados como autoridade pelo cliente. A janela carrega somente arquivos locais, com isolamento de contexto, sandbox e sem acesso a Node no renderer.

Não há hipotecas ou leilões. Diante de aluguel sem saldo, o jogador pode vender imóveis escolhidos ao banco por 50% do investimento, solicitar venda automática suficiente ou negociar com um jogador específico antes de confirmar. Negociações manuais usam propriedade, destinatário e preço escolhidos. Revalidar dono e saldo no servidor e transferir propriedade e dinheiro juntos, apenas uma vez. Melhorias acompanham a propriedade.

O anfitrião escolhe tabuleiro para até oito jogadores (60 casas e 40 propriedades) ou até quatro (32 casas e 20 propriedades). Ambos têm quatro indústrias de R$ 25.000, uma por lado. A definição compartilhada está em `public/board.js`. Indústrias cobram o preço original multiplicado pela soma dos dados; não recebem melhorias. Quatro indústrias do mesmo dono encerram a partida imediatamente, inclusive após negociação. Não há limite de rodadas; a outra vitória é por sobrevivência.

As casas devem comportar visualmente os oito peões em grade 4×2. Peças são peões coloridos e numerados, não círculos ou botões. `lastMove` é produzido pelo servidor com o caminho autoritativo; o cliente deve animar cada casa confirmada e bloquear novas ações até concluir. Não derive um destino diferente no cliente nem pule diretamente para a posição final em uma jogada normal.

Prisão e Vá à prisão ficam em cantos opostos. Visita normal não prende. Carta Sorte, terceira dupla no mesmo turno e casa Vá à prisão prendem. Saída por dupla, três turnos próprios cumpridos ou carta guardada. A dupla de saída não dá jogada extra. A pausa deve congelar o tempo restante no servidor e impedir ações da partida até retomar. Reconectar usa a sessão existente sem resetar progresso; sair da sala é desistência. Valide com `npm test`, `npm run test:desktop`, `npm run test:trade` e `npm run test:expanded`.
