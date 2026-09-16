# Jogos Metralhas

Bundle de jogos para Guilherme e seus amigos jogarem juntos online. Codenames e Spyfall são exemplos de jogos planejados; outros poderão ser adicionados pelo grupo.

Cada jogo será desenvolvido de forma independente, em uma pasta na raiz com o nome do jogo, por exemplo `Codenames/` ou `Spyfall/`. Ainda não há jogos implementados.

## Tecnologias e launcher futuro

Os jogos devem ser prioritariamente aplicativos desktop distribuídos como executáveis, inicialmente para Windows (`.exe`), com janela própria e sem depender de abrir um navegador. A versão distribuída deve incluir os componentes necessários para jogar, sem exigir ferramentas de desenvolvimento. Uma versão exclusivamente web só deve ser escolhida quando solicitada explicitamente.

É permitido usar tecnologias web internamente e empacotá-las em um aplicativo desktop. Essa preferência de distribuição não impõe uma linguagem, engine ou framework. Jogos online ainda podem precisar de um servidor multiplayer, cujo funcionamento deve ser documentado.

Não existe uma tecnologia única obrigatória para o bundle. Cada responsável pode escolher a linguagem, engine, framework e ferramentas do próprio jogo, mesmo que sejam diferentes das usadas nos demais jogos. Essa liberdade é uma diretriz do projeto, não uma decisão temporariamente pendente. Não é necessário reescrever ou padronizar os jogos em uma mesma tecnologia para participar do bundle.

Posteriormente, os jogos serão reunidos em um mega launcher, com um executável central para selecionar e iniciar os jogos, lobby online, convites, lista de amigos, criação e entrada em salas e outros recursos compartilhados. A tecnologia do launcher e os contratos de integração serão definidos nessa etapa, respeitando as tecnologias de cada jogo.

Por enquanto, cada jogo deve funcionar e ser testado de forma independente e documentar seus requisitos de execução, build, rede e pontos de entrada. A integração poderá precisar de adaptadores ou processos separados, conforme as tecnologias escolhidas; não se deve presumir que todo o código será compilado no mesmo binário. Não implementar o launcher ou seus serviços compartilhados dentro de uma tarefa de jogo.

## Antes de começar

1. Leia [AGENTS.md](AGENTS.md) e [CONTRIBUTING.md](CONTRIBUTING.md).
2. Consulte [RESPONSAVEIS.md](RESPONSAVEIS.md). Para jogos existentes, trabalhe apenas na pasta atribuída a você. Para um jogo novo, você pode começar sem cadastro prévio em uma nova pasta com o nome do jogo, desde que ela não exista nem esteja atribuída.
3. Abra sua IA na raiz do repositório e peça que leia `AGENTS.md`, `RESPONSAVEIS.md` e as instruções do seu jogo antes de fazer alterações.
4. Trabalhe apenas na pasta atribuída ou na nova pasta proposta. No primeiro PR, informe jogo, pasta, seu nome e usuário GitHub; registre também esses dados na documentação local como cadastro pendente. Guilherme cadastra o responsável e aprova o PR antes da integração. Não altere o cadastro por conta própria.

Exemplo de organização futura, sem atribuição de responsáveis:

```text
Jogos-Metralhas/
  AGENTS.md
  CONTRIBUTING.md
  RESPONSAVEIS.md
  Codenames/
    README.md
    AGENTS.md
    ... código, recursos e testes do Codenames
  Spyfall/
    README.md
    AGENTS.md
    ... código, recursos e testes do Spyfall
```

## Isolamento e colaboração

Cada colaborador e sua IA só podem criar ou alterar arquivos do próprio jogo. Guilherme é o único que pode alterar qualquer pasta e os arquivos compartilhados. As IAs devem respeitar o escopo de jogo mesmo quando operadas por Guilherme; alterações fora dele exigem um pedido explícito dele para aquele trabalho.

Os jogos devem manter código, recursos, dependências, arquivos de configuração, testes e instruções dentro da própria pasta. Não criar dependências de outro jogo. Cada jogo deve documentar como executar e testar isoladamente, suas necessidades de rede e os pontos previstos para integração futura, sem impor agora um framework ou protocolo ao bundle.

O GitHub deve receber cada entrega concluída e validada. O procedimento de sincronização está em `CONTRIBUTING.md`. Não existe sincronização automática em segundo plano configurada neste projeto.

## Alcance das regras

`AGENTS.md` é a fonte principal. Há arquivos de encaminhamento para outras ferramentas, mas a leitura automática depende da IA utilizada. Se necessário, peça explicitamente que ela leia as regras.

Todos podem abrir pull requests, inclusive por forks. Para integrar uma contribuição em `main`, é obrigatória a aprovação de Guilherme (`@GuimaraesCRM`), definido como responsável por todos os arquivos em `.github/CODEOWNERS`. Novos commits que alterem o diff invalidam a aprovação anterior.

A proteção de `main` exige revisão do responsável e bloqueia force push e exclusão da branch. Guilherme mantém a exceção administrativa para manutenção própria; a IA não pode usá-la para integrar PRs sem um pedido explícito dele. Colaboradores não devem receber acesso administrativo.

Instruções em texto não impedem edições locais em outras pastas. A revisão deve rejeitar alterações fora da pasta atribuída ou, no primeiro PR de um jogo novo, fora da nova pasta proposta.
