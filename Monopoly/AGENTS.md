# Monopoly

Responsável proposto: Guilherme Guimarães, `@GuimaraesCRM`. Cadastro pendente de revisão do primeiro PR.

Escopo: somente `Monopoly/`. As regras do `AGENTS.md` da raiz continuam válidas. Não editar outros jogos, cadastro de responsáveis ou infraestrutura compartilhada.

Jogo de propriedades simplificado, online para 2 a 8 pessoas, com tabuleiro em perspectiva 3D. Aplicativo desktop Electron, distribuído como `.exe` para Windows, sem exigir navegador ou Node.js do jogador. Node.js 22+ é necessário apenas para desenvolvimento ou servidor dedicado. Execute `npm start` para iniciar, `npm test` para validar e `npm run build` para gerar o executável. Estado e decisões da partida pertencem ao servidor. Nunca aceite saldo, posição, resultado de dados ou identidade do jogador informados como autoridade pelo cliente. A janela carrega somente arquivos locais, com isolamento de contexto, sandbox e sem acesso a Node no renderer.

Não há venda automática, hipotecas ou leilões. Negociações manuais de compra/venda são iniciadas apenas pelo jogador da vez, com propriedade, destinatário e preço escolhidos. Somente o destinatário aceita ou recusa, inclusive fora do turno. Revalidar dono e saldo no servidor e transferir propriedade e dinheiro juntos, apenas uma vez. Cancelar ofertas ao mudar o turno ou sair um participante. Melhorias acompanham a propriedade.
