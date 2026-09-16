# Como contribuir

## Começar um jogo

Peça a Guilherme o cadastro do seu usuário do GitHub e da pasta em `RESPONSAVEIS.md`. Depois, crie a pasta com o nome exato do jogo e mantenha todo o desenvolvimento dentro dela. Apenas Guilherme pode mudar responsáveis e regras compartilhadas.

Inclua no `README.md` do jogo:

- Nome do jogo, responsável e usuário GitHub.
- Estado atual e regras básicas para jogar.
- Pré-requisitos e comandos reais para instalar, executar e validar.
- Como testar separadamente do futuro executável central.
- Necessidades de rede, jogadores, salas e estado da partida, conforme forem definidas.
- Pontos de entrada previstos para futura integração e pendências conhecidas.

Inclua também um `AGENTS.md` local identificando responsável, pasta permitida e comandos técnicos. Reafirme que as regras da raiz continuam válidas. Coloque regras de ignore específicas na pasta do jogo.

## Atualizar e publicar

1. Confira `git status` e preserve alterações locais existentes.
2. Execute `git fetch origin`. Com a árvore limpa, atualize a `main` local com `git switch main` e `git pull --ff-only origin main`. Se houver divergência ou trabalho pendente, não descarte nada para forçar essa atualização.
3. Crie uma branch como `jogo/Codenames/seu-usuario/descricao`. Adapte o nome ao jogo cadastrado.
4. Desenvolva e valide somente dentro da pasta autorizada. Revise `git diff` e `git status --short`.
5. Adicione apenas caminhos específicos do seu jogo, por exemplo `git add -- Codenames/`. Revise `git diff --cached --name-only` e `git diff --cached` para garantir que nada indevido entrou.
6. Faça um commit descritivo e publique com `git push -u origin NOME-DA-BRANCH`. Sem permissão no repositório principal, publique no seu fork.
7. Abra um pull request para `main`, descrevendo jogo, alterações e validação. Guilherme revisa o escopo antes da integração.

Repita a sincronização a cada entrega concluída. Não deixe trabalho finalizado apenas no computador sem informar o motivo. Nunca faça force push ou commit de credenciais. Não resolva conflitos em outros jogos ou arquivos compartilhados: encaminhe a Guilherme.

## Revisão por Guilherme

Verifique o autor, sua atribuição e todos os caminhos alterados, inclusive exclusões e renomeações. Recuse alterações fora do jogo do colaborador. Mudanças compartilhadas devem ser feitas por Guilherme em tarefa própria.

Guilherme pode configurar proteção de `main`, revisão obrigatória e restrições de escrita no GitHub. A documentação sozinha não aplica controle de acesso por pasta. Até essas configurações serem feitas, não há bloqueio técnico instalado.
