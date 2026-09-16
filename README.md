# Jogos Metralhas

Bundle de jogos para Guilherme e seus amigos jogarem juntos online. Codenames e Spyfall são exemplos de jogos planejados; outros poderão ser adicionados pelo grupo.

Cada jogo será desenvolvido de forma independente, em uma pasta na raiz com o nome do jogo, por exemplo `Codenames/` ou `Spyfall/`. O executável único, a seleção de jogos, o lobby e a integração online entre os jogos serão desenvolvidos posteriormente. Ainda não há jogos implementados nem tecnologia definida.

## Antes de começar

1. Leia [AGENTS.md](AGENTS.md) e [CONTRIBUTING.md](CONTRIBUTING.md).
2. Consulte [RESPONSAVEIS.md](RESPONSAVEIS.md). Guilherme deve cadastrar seu usuário do GitHub e sua pasta antes de você começar.
3. Abra sua IA na raiz do repositório e peça que leia `AGENTS.md`, `RESPONSAVEIS.md` e as instruções do seu jogo antes de fazer alterações.
4. Trabalhe apenas na pasta do jogo atribuído a você.

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

Instruções em texto não são uma barreira de permissões. Para controlar o que entra na branch principal, Guilherme deve configurar proteção da branch e revisão obrigatória no GitHub. Essas proteções ainda não estão configuradas. Colaboradores sem permissão de escrita podem contribuir por forks e pull requests; a revisão deve rejeitar alterações fora da pasta atribuída.
