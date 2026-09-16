# Monopoly Metralhas — Metrópole

Primeira versão de um jogo de propriedades simplificado para **2 a 8 pessoas online**, inspirado na dinâmica de Monopoly e Business Tour. Tabuleiro original com aparência 3D feita em perspectiva CSS; não utiliza arte desses jogos. Não é uma reprodução integral das regras clássicas.

**Responsável proposto:** Guilherme Guimarães, `@GuimaraesCRM`. **Pasta:** `Monopoly/`. Cadastro pendente de revisão do primeiro PR. Todo o código, configuração e recursos deste jogo ficam nesta pasta.

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
npm run build
```

O executável portátil é gerado em `dist/Monopoly-Metralhas-0.1.0-x64.exe`. Distribua esse arquivo aos amigos; não é necessário copiar o código-fonte. O build inicial baixa componentes de empacotamento. O executável ainda não tem assinatura digital. Outros sistemas operacionais não foram preparados ou validados.

O teste desktop usa uma janela oculta e oito clientes, exige a porta 3000 livre e grava capturas em `test-results/` e um perfil descartável em `.cache/`. Para validar o aplicativo empacotado, defina `MONOPOLY_TEST_EXE` com o caminho absoluto de `dist/win-unpacked/Monopoly Metralhas.exe` e execute `npm run test:desktop`.

## Jogar com os amigos

1. Todos abrem o executável e informam seus nomes.
2. Um jogador escolhe **Hospedar no meu computador**. Isso abre o servidor TCP na porta 3000 e cria uma sala.
3. O anfitrião envia o código da sala e um endereço do servidor acessível aos amigos. O aplicativo lista os endereços locais da máquina.
4. Os amigos informam esse endereço, por exemplo `http://192.168.1.10:3000`, e o código, e escolhem **Entrar**.
5. Com 2 a 8 jogadores na sala, o anfitrião escolhe **Começar partida**.

Na mesma rede, use o IP local do anfitrião e permita o aplicativo no firewall para a rede utilizada. Pela internet, é necessário um servidor acessível ou uma rede privada que conecte os computadores. O código da sala sozinho não estabelece conexão entre redes. Não há serviço público hospedado, descoberta automática, relay ou configuração automática de roteador nesta versão.

Um servidor dedicado pode ser iniciado com `npm run server`. A variável `PORT` altera sua porta (padrão 3000). Os aplicativos podem se conectar a ele e usar **Criar sala**, em vez de hospedar localmente. Para exposição pública, coloque-o atrás de HTTPS e controles de acesso/limite de tráfego; a versão inicial foi feita para partidas de um grupo de amigos, não como serviço público aberto.

O anfitrião precisa manter o aplicativo aberto; fechá-lo encerra seu servidor e todas as salas nele. As partidas ficam em memória e não sobrevivem a reinicialização. Clientes guardam a sessão localmente e tentam reconectar, mas fechar um cliente não pausa seu turno: após 75 segundos o turno passa. **Sair da sala** durante a partida é desistência. Na sala de espera, se o criador sair, o próximo jogador vira anfitrião da sala (não transfere a hospedagem do servidor).

## Regras desta versão

- Cada jogador começa com $1.500; tabuleiro de 24 casas e 18 propriedades.
- Dois dados por turno, sorteados pelo servidor. Passar pela partida rende $200.
- Ao cair em terreno livre, compre ou passe. Em terreno de outra pessoa, pague aluguel automaticamente.
- No seu turno, melhore qualquer terreno seu até três níveis. Cada melhoria custa metade do preço original; o aluguel é o valor base multiplicado por `nível + 1`.
- Sorte dá $150 ou cobra $90. Imposto custa $120; café e férias são descanso.
- Sem saldo suficiente para uma cobrança, o jogador paga o saldo restante, vai à falência e devolve seus terrenos ao banco. Não há venda automática, hipotecas, leilões ou negociações.
- A partida termina com um sobrevivente ou ao completar 20 rodadas. Vence o maior patrimônio: saldo + preço dos terrenos + custo das melhorias. Empates dividem a vitória.
- Turnos de até 75 segundos. Dados iguais não concedem turno extra. Não há prisão nem bônus por conjunto nesta versão.

## Arquitetura e integração futura

- `desktop.js` / `preload.cjs`: aplicativo, janela local isolada, hospedagem opcional e comunicação com o servidor.
- `game.js`: regras e estado autoritativo; clientes não escolhem dados, saldo ou posição.
- `server.js`: API HTTP com sessões por token; salas de até oito pessoas, estado em memória e atualização por polling.
- `public/`: interface e tabuleiro em perspectiva. A interface é carregada localmente no aplicativo, não servida para um navegador.
- `test/`: testes de regras e integração de oito clientes HTTP.

O futuro launcher poderá iniciar este executável como processo independente. Salas e hospedagem aqui são exclusivas do Monopoly; lista de amigos, convites integrados, autenticação global e lobby compartilhado permanecem para a etapa do launcher. O contrato de integração ainda não foi definido.

Limitações atuais: sem bots, chat, reconexão após reiniciar o servidor, persistência de partidas ou câmera 3D livre. A conectividade por internet depende da configuração de rede do anfitrião/servidor. O equilíbrio econômico ainda precisa de partidas reais com o grupo.
