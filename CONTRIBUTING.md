# Como contribuir

## Começar um jogo

Para um jogo novo, você pode começar e enviar o primeiro PR sem cadastro prévio. Consulte `RESPONSAVEIS.md` e a `main` atualizada para conferir que o jogo e sua pasta ainda não estão cadastrados nem existem no projeto. Crie uma nova pasta na raiz com o nome do jogo e mantenha todas as suas alterações dentro dela, inclusive os ajustes solicitados na revisão do primeiro PR.

Informe seu nome, usuário GitHub, jogo e pasta no PR e na documentação local, indicando que o cadastro está pendente. Guilherme revisa a proposta, cadastra manualmente o responsável em `RESPONSAVEIS.md` e aprova o PR antes da integração. Você não deve alterar o cadastro nem arquivos compartilhados. O envio do PR não reserva automaticamente uma pasta; propostas conflitantes são decididas por Guilherme.

Para trabalhar em um jogo já existente, a pasta deve estar atribuída a você em `RESPONSAVEIS.md`. A exceção de primeiro PR não permite assumir ou modificar jogos existentes sem atribuição. Apenas Guilherme pode mudar responsáveis e regras compartilhadas.

Escolha livremente a tecnologia do seu jogo: linguagem, engine, framework e ferramentas podem ser diferentes das dos outros jogos. Não há stack única obrigatória. Mantenha o jogo executável e testável de forma independente, com suas dependências e configurações na própria pasta.

Priorize a entrega como executável desktop para Windows (`.exe`), em janela própria, sem exigir navegador ou ferramentas de desenvolvimento do jogador. Tecnologias web internas são permitidas se empacotadas como aplicativo. Uma versão exclusivamente para navegador deve ser uma alternativa explicitamente solicitada, não a entrega padrão. Documente separadamente como iniciar ou acessar o servidor multiplayer, quando necessário.

A união acontecerá posteriormente em um mega launcher com seleção e inicialização dos jogos, lobby online, convites, lista de amigos e criação e entrada em salas. Os contratos e adaptadores de integração serão definidos nessa etapa, preservando as tecnologias escolhidas. Não implemente infraestrutura compartilhada nem altere outros jogos para antecipar essa integração.

Inclua no `README.md` do jogo:

- Nome do jogo, responsável e usuário GitHub.
- Estado atual e regras básicas para jogar.
- Tecnologias escolhidas e versões necessárias de runtimes, engines e ferramentas.
- Pré-requisitos e comandos reais para instalar, executar e validar.
- Como gerar e iniciar o executável desktop, quais sistemas são suportados e quais componentes acompanham a distribuição. Enquanto o empacotamento não estiver implementado, registre essa pendência explicitamente.
- Como testar separadamente do futuro executável central.
- Necessidades de rede, jogadores, salas e estado da partida, conforme forem definidas.
- Pontos de entrada previstos para futura integração e pendências conhecidas.

Inclua também um `AGENTS.md` local identificando responsável, pasta permitida e comandos técnicos. Reafirme que as regras da raiz continuam válidas. Coloque regras de ignore específicas na pasta do jogo.

## Atualizar e publicar

1. Confira `git status` e preserve alterações locais existentes.
2. Execute `git fetch origin`. Com a árvore limpa, atualize a `main` local com `git switch main` e `git pull --ff-only origin main`. Se houver divergência ou trabalho pendente, não descarte nada para forçar essa atualização.
3. Crie uma branch como `jogo/Codenames/seu-usuario/descricao`. Adapte o nome ao jogo cadastrado ou ao jogo novo proposto no primeiro PR.
4. Desenvolva e valide somente dentro da pasta autorizada. Revise `git diff` e `git status --short`.
5. Adicione apenas caminhos específicos do seu jogo, por exemplo `git add -- Codenames/`. Revise `git diff --cached --name-only` e `git diff --cached` para garantir que nada indevido entrou.
6. Faça um commit descritivo e publique com `git push -u origin NOME-DA-BRANCH`. Sem permissão no repositório principal, publique no seu fork.
7. Abra um pull request para `main`, descrevendo jogo, alterações e validação. Todos podem abrir pull requests, inclusive por forks. Aguarde a aprovação explícita de Guilherme (`@GuimaraesCRM`) antes da integração; a aprovação de outra pessoa não a substitui. Se novos commits alterarem o diff, será necessária nova aprovação.

Repita a sincronização a cada entrega concluída. Não deixe trabalho finalizado apenas no computador sem informar o motivo. Nunca faça force push ou commit de credenciais. Não resolva conflitos em outros jogos ou arquivos compartilhados: encaminhe a Guilherme.

## Revisão por Guilherme

Verifique o autor, sua atribuição e todos os caminhos alterados, inclusive exclusões e renomeações. No primeiro PR de um jogo novo, confira que as alterações do colaborador estão restritas à nova pasta proposta, resolva eventuais conflitos de responsabilidade e cadastre manualmente o jogo, a pasta e o autor em `RESPONSAVEIS.md` antes de aprovar e integrar o PR. Recuse alterações fora do jogo do colaborador. Mudanças compartilhadas devem ser feitas por Guilherme em tarefa própria.

A branch `main` exige pull request, pelo menos uma aprovação e revisão do responsável definido em `.github/CODEOWNERS`: `@GuimaraesCRM` para todos os arquivos. Aprovações antigas são descartadas quando o diff muda. Force push e exclusão da branch estão desabilitados.

Guilherme mantém sua exceção administrativa para manutenção do próprio repositório; colaboradores não devem receber acesso administrativo. A IA não pode usar essa exceção para integrar um pull request sem pedido explícito dele. O GitHub não permite que o autor aprove o próprio pull request: PRs abertos pela conta de Guilherme precisam de uma decisão explícita dele para integração administrativa.

A revisão obrigatória controla a entrada em `main`, mas não impede edições locais em outras pastas. A atribuição dos jogos e a revisão dos caminhos continuam obrigatórias.
