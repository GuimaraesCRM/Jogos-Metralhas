# Metralhopole

> **Migração 3D:** a nova implementação visual em Godot 4 está em [`godot/`](godot/README.md). Ela já possui uma única cena 3D para tabuleiro, peão, câmera e dados físicos. A versão Electron permanece disponível como referência das regras e do multiplayer durante a migração.

Primeira versão de um jogo de propriedades simplificado para **2 a 8 pessoas online**, inspirado na dinâmica de Monopoly e Business Tour. Tabuleiro original com aparência 3D feita em perspectiva CSS; não utiliza arte desses jogos. Não é uma reprodução integral das regras clássicas.

**Responsável proposto:** Guilherme Guimarães, `@GuimaraesCRM`. **Pasta:** `Metralhopole/`. Cadastro pendente de revisão do primeiro PR. Todo o código, configuração e recursos deste jogo ficam nesta pasta.

## Aplicativo desktop

A entrega é um executável Windows x64 com janela própria. O jogador não precisa de navegador, Node.js ou ferramentas de desenvolvimento. Electron inclui o runtime da interface e do servidor. O servidor pode ser hospedado pelo próprio aplicativo ou executado separadamente.

Para desenvolver, instale Node.js 22 ou superior e execute nesta pasta:

```powershell
npm ci
npm start
```

Para validar regras e API e gerar o executável:

```powershell
npm test
npm run test:desktop
npm run test:trade
npm run test:expanded
npm run build
```

O executável portátil é gerado em `dist/Metralhopole-0.2.1-x64.exe`. Distribua esse arquivo aos amigos; não é necessário copiar o código-fonte. O build inicial baixa componentes de empacotamento. O executável ainda não tem assinatura digital. Outros sistemas operacionais não foram preparados ou validados.

O teste desktop usa uma janela oculta e oito clientes, exige a porta 3000 livre e grava capturas em `test-results/` e um perfil descartável em `.cache/`. Para validar o aplicativo empacotado, defina `METRALHOPOLE_TEST_EXE` com o caminho absoluto de `dist/win-unpacked/Metralhopole.exe` e execute `npm run test:desktop`.

`npm run test:trade` usa dois aplicativos com perfis separados e um servidor local de teste em porta disponível para verificar compra, venda, aceite, recusa, cancelamento e sincronização. Também aceita `METRALHOPOLE_TEST_EXE` para testar o aplicativo empacotado.

`npm run test:expanded` verifica prisão, carta de saída, pausa, reconexão após interrupção da conexão e reabertura do aplicativo com o mesmo progresso, além da vitória ao negociar a quarta indústria. Usa um servidor de teste com estado controlado, nunca comandos de manipulação de estado na API pública.

## Jogar com os amigos

1. Todos abrem o executável e informam seus nomes.
2. Um jogador escolhe **Hospedar no meu computador**. Isso abre o servidor TCP na porta 3000 e cria uma sala.
3. O anfitrião envia o código da sala e um endereço do servidor acessível aos amigos. O aplicativo lista os endereços locais da máquina.
4. Os amigos informam esse endereço, por exemplo `http://192.168.1.10:3000`, e o código, e escolhem **Entrar**.
5. Com 2 a 8 jogadores na sala, o anfitrião escolhe **Começar partida**.

Na mesma rede, use o IP local do anfitrião e permita o aplicativo no firewall para a rede utilizada. Pela internet, é necessário um servidor acessível ou uma rede privada que conecte os computadores. O código da sala sozinho não estabelece conexão entre redes. Não há serviço público hospedado, descoberta automática, relay ou configuração automática de roteador nesta versão.

Um servidor dedicado pode ser iniciado com `npm run server`. A variável `PORT` altera sua porta (padrão 3000). Os aplicativos podem se conectar a ele e usar **Criar sala**, em vez de hospedar localmente. Para exposição pública, coloque-o atrás de HTTPS e controles de acesso/limite de tráfego; a versão inicial foi feita para partidas de um grupo de amigos, não como serviço público aberto.

O anfitrião precisa manter o aplicativo aberto; fechá-lo encerra seu servidor e todas as salas nele. As partidas ficam em memória e não sobrevivem a reinicialização. Clientes guardam a sessão localmente e tentam reconectar, mas fechar um cliente não pausa seu turno: após 75 segundos o turno passa. **Sair da sala** durante a partida é desistência. Na sala de espera, se o criador sair, o próximo jogador vira anfitrião da sala (não transfere a hospedagem do servidor).

## Reconexão e pausa

O botão **Reconectar à partida** tenta novamente usando a sessão já guardada no aplicativo. O servidor mantém o mesmo jogador, dinheiro, propriedades, melhorias, posição, situação de prisão e cartas. Fechar e reabrir um cliente no mesmo perfil também recupera essa sessão. Não há nova vaga nem reinício do jogador. Não limpe os dados do aplicativo nem use **Sair da sala** para reconectar: sair significa desistir.

A reconexão exige que o servidor da partida continue ativo e acessível; ela não recupera partidas após reinício do anfitrião/servidor. Salas sem atividade por 24 horas podem ser removidas. Enquanto desconectado, o turno continua correndo, a menos que alguém pause a partida.

Qualquer jogador ativo pode usar **Pausar partida** e **Retomar partida**. A pausa é global e controlada pelo servidor: congela exatamente os milissegundos restantes, bloqueia dados, compras, melhorias e negociações, e mantém ofertas pendentes. Retomar continua com o tempo que faltava, sem devolver 75 segundos. Um jogador ainda pode desistir durante a pausa; se ele era o jogador da vez, a próxima pessoa começa com o turno completo, ainda pausado. A pausa não conta como tempo cumprido na prisão.

## Regras desta versão

- Cada jogador começa com **R$ 500.000**. O tabuleiro tem **60 casas: 40 propriedades comuns, quatro indústrias e 16 casas especiais**. Clique em uma casa para consultar detalhes. Há vista em perspectiva e vista de cima.
- O tabuleiro usa casas ampliadas e organiza até oito peões em uma grade de quatro por duas dentro da mesma casa. Cada peão tem a cor e o número do jogador. Depois que o servidor confirma os dados, a interface anima o peão por todas as casas do caminho; envios à prisão terminam com o salto para o canto da prisão. A posição final continua sendo definida exclusivamente pelo servidor.
- A câmera do tabuleiro aceita rotação e inclinação por arraste, zoom pela roda do mouse e controles visíveis para aproximar, afastar, girar e mudar o ângulo. Há atalhos para vista superior e para restaurar a perspectiva inicial.
- A mesa ocupa a tela inteira desde a entrada. Criação e entrada em salas aparecem em um painel flutuante; durante a partida, somente as ações e o HUD permanecem sobre o tabuleiro. `Esc` abre e fecha o painel com código da sala, jogadores, propriedades, histórico, pausa, reconexão, regras e saída.
- Os peões têm volume, iluminação e sombra sobre as casas. Os dois dados são cubos de seis faces e executam uma animação de arremesso antes de parar nos valores sorteados pelo servidor.
- Personagens, casas, hotel e o par de dados usam os modelos GLB fornecidos e renderização WebGL local. Cada pessoa escolhe um dos 12 personagens antes de entrar; o servidor impede dois jogadores de usarem o mesmo modelo. Personagens e construções usam a textura original compartilhada `public/models/Textures/colormap.png`. Os dois dados vêm juntos no modelo `Dices.glb` e são animados como uma única peça visual a cada lançamento.
- As propriedades comuns custam de **R$ 40.000 a R$ 148.000**, com aluguéis base de **R$ 3.000 a R$ 13.800**. Esses valores são parâmetros de jogo, não preços reais de mercado.
- Dois dados são sorteados pelo servidor. Passar pela partida rende **R$ 50.000**. Uma dupla permite nova jogada no mesmo turno, depois de resolver a casa. A terceira dupla consecutiva manda à prisão antes de mover pela terceira jogada. A contagem reinicia ao passar a vez.
- As 40 propriedades têm nomes de locais reais de várias cidades brasileiras e são divididas em dez grupos de quatro por cor. A seleção e a ordem são próprias da Metralhopole.
- Ao cair em terreno livre, compre ou passe. Em terreno de outra pessoa, pague aluguel automaticamente. Possuir as quatro propriedades de uma cor dobra o aluguel base dos terrenos sem melhoria daquele grupo.
- No seu turno, melhore qualquer terreno seu até três níveis. Cada melhoria custa metade do preço original; o aluguel é o valor base multiplicado por `nível + 1`. Em terrenos melhorados, vale esse aluguel do nível, sem outro multiplicador pelo grupo completo.
- Cada indústria custa **R$ 25.000**, com uma indústria em cada lado do tabuleiro. Seu aluguel é **preço original × soma dos dois dados**: 3 + 4 custa R$ 175.000. O preço de uma negociação não altera essa base. Indústrias não recebem melhorias, mas podem ser compradas do banco e negociadas.
- Sorte pode dar **R$ 25.000**, cobrar **R$ 15.000**, mandar à prisão ou conceder a carta **Sair da prisão**. Imposto custa **R$ 18.000**; Férias é descanso. O baralho é embaralhado pelo servidor. Cartas de saída ficam com o jogador até o uso e então voltam ao descarte; também são devolvidas se ele falir ou desistir.
- O aluguel abre uma confirmação antes da transferência. Sem saldo, o jogador pode vender imóveis escolhidos ao banco por 50% do investimento, usar venda automática suficiente ou negociar com outro jogador. Sem patrimônio suficiente, pode declarar falência. Não há hipotecas ou leilões.
- Ao criar a sala, o anfitrião escolhe a mesa para até oito jogadores (60 casas, 40 propriedades) ou até quatro (32 casas, 20 propriedades). A mesa menor mantém uma Sorte e uma indústria em cada lado.
- Na primeira visita, uma propriedade livre só pode ser comprada. Na segunda visita do dono, podem ser construídas até três casas; na terceira, um hotel. Os multiplicadores de aluguel são 1×, 2×, 3×, 5× e 8×. Cada casa custa 35% do terreno e o hotel, 60%.
- O baralho inclui promoções, restituições, prêmios, reparos, encanamento, multas, prisão e saída da prisão. A METRALHA CORINGA aparece uma única vez e compra um imóvel livre por 50%. Carnaval aumenta em 50% o aluguel de um imóvel próprio até outro Carnaval; Apagão suspende por cinco rodadas o aluguel de um imóvel adversário.
- No próprio turno, antes ou depois de lançar os dados, o jogador pode propor **comprar uma propriedade de outro jogador** ou **vender uma de suas propriedades**. Ele escolhe com quem negociar, a propriedade e o preço total em dinheiro (inteiro positivo).
- A pessoa escolhida pode aceitar ou recusar mesmo fora do próprio turno. Sem aceitação, nenhum dinheiro ou propriedade muda de mãos. A venda inclui todas as melhorias; o servidor confere proprietário e saldo do comprador ao enviar e ao aceitar. O autor não pode aceitar a própria oferta e terceiros não podem responder por outro jogador.
- Há uma oferta pendente por vez. Enquanto aguarda resposta, o autor pode cancelar ou encerrar o turno se já lançou os dados; dados, compra do banco e melhorias ficam pausados, mas o relógio de 75 segundos continua contando. Fim do turno, tempo esgotado ou saída de um participante da negociação cancela a oferta. Após recusa ou cancelamento, o autor pode enviar outra proposta no mesmo turno. As ofertas e seus resultados ficam visíveis na sala.
- A partida termina com **um sobrevivente** ou quando alguém conquista **as quatro indústrias**, inclusive por negociação e fora do próprio turno ao aceitar uma oferta. A vitória é imediata. **Não há limite de rodadas nem vitória automática por patrimônio**; o patrimônio exibido é apenas informativo.
- Turnos de até 75 segundos, contando também jogadas extras e negociações. Não há bônus por conjunto de propriedades comuns. O equilíbrio econômico ainda precisa ser avaliado em partidas reais; mais propriedades e ausência de limite não garantem uma duração específica.

## Prisão

A prisão fica no canto da casa 15; **Vá à prisão** fica no canto oposto, casa 45. Os números são índices internos de 0 a 59. Cair normalmente na casa 15 é **apenas visita**, sem impedir o próximo turno.

O jogador é preso por carta Sorte, pela terceira dupla consecutiva no mesmo turno ou ao cair em Vá à prisão. Ele vai diretamente à casa da prisão, não ganha bônus de partida pelo transporte e perde as jogadas extras. O turno em que foi enviado não conta como espera.

Nos turnos seguintes, pode:

- **Tentar uma dupla:** se conseguir, sai e anda a soma desses dados, sem jogada extra pela dupla de saída. Se falhar, cumpre um turno preso, sem se mover.
- **Esperar na prisão:** cumpre um turno sem lançar dados. Depois de três turnos próprios cumpridos, está livre e volta a andar no próximo turno. Um timeout antes de tentar sair também conta como um turno de espera; nunca conta duas vezes no mesmo turno.
- **Usar uma carta Sair da prisão:** antes de lançar os dados, consome uma carta guardada, sai e pode jogar normalmente naquele turno. Não há pagamento de fiança nesta versão.

Jogadores presos continuam recebendo aluguéis e podem negociar no próprio turno. Cartas de saída não são negociáveis.

## Arquitetura e integração futura

- `desktop.js` / `preload.cjs`: aplicativo, janela local isolada, hospedagem opcional e comunicação com o servidor.
- `game.js`: regras e estado autoritativo; clientes não escolhem dados, saldo ou posição.
- `public/board.js`: definição única do tabuleiro, valores em reais e regras econômicas compartilhadas com a interface.
- `server.js`: API HTTP com sessões por token; salas de até oito pessoas, estado em memória e atualização por polling.
- `public/`: interface e tabuleiro em perspectiva. A interface é carregada localmente no aplicativo, não servida para um navegador.
- `test/`: testes de regras e integração de oito clientes HTTP.

O futuro launcher poderá iniciar este executável como processo independente. Salas e hospedagem aqui são exclusivas do Metralhopole; lista de amigos, convites integrados, autenticação global e lobby compartilhado permanecem para a etapa do launcher. O contrato de integração ainda não foi definido.

Limitações atuais: sem bots, chat, reconexão após reiniciar o servidor, persistência de partidas ou câmera 3D livre. A conectividade por internet depende da configuração de rede do anfitrião/servidor. O equilíbrio econômico ainda precisa de partidas reais com o grupo.
