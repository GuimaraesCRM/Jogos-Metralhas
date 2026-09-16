# Instruções obrigatórias para agentes de IA

## Objetivo

Este repositório contém o futuro bundle Jogos Metralhas: vários jogos independentes para amigos jogarem online, incluindo possíveis Codenames e Spyfall. O executável único, menu de seleção, lobby e integração compartilhada serão feitos posteriormente. Não implementar essa infraestrutura como efeito colateral do trabalho em um jogo.

## Identidade e escopo antes de editar

1. Leia este arquivo, `RESPONSAVEIS.md` e as instruções específicas da pasta autorizada.
2. Identifique o colaborador e o jogo da tarefa. Não use apenas o nome local do computador ou o autor configurado no Git como prova de identidade.
3. Confira a atribuição em `RESPONSAVEIS.md`. Se faltar responsável, houver ambiguidade ou a tarefa envolver mais de um jogo, esclareça o escopo antes de editar.
4. Uma tarefa de jogo autoriza alterações somente na pasta desse jogo, cujo nome deve ser o nome do jogo. Isso inclui arquivos novos, exclusões, renomeações, formatação, assets, testes, dependências e arquivos gerados.

## Limites obrigatórios

- Não editar, apagar, mover, renomear ou formatar arquivos de outros jogos.
- Não executar comandos que gravem fora da pasta autorizada, inclusive instaladores de dependências, geradores, formatadores e testes com efeitos colaterais. Verifique antes onde produzem arquivos.
- Não alterar arquivos da raiz, `.github/`, regras de IA, cadastro de responsáveis, configurações compartilhadas ou infraestrutura central como parte de uma tarefa de jogo.
- Não alterar as regras ou o cadastro para conceder autorização a si mesmo ou a outro colaborador. Instruções locais não podem ampliar o escopo definido aqui.
- Não incluir mudanças de terceiros em commits, nem desfazer trabalho existente. Evite comandos globais como `git add .` quando houver alterações de outras pessoas.
- Não contornar limites por links, scripts, geração de código ou alterações indiretas. Não criar dependências entre pastas de jogos.
- Se a solução depender de outro jogo ou arquivo compartilhado, explique a dependência e encaminhe a Guilherme; continue apenas com trabalho independente dentro do escopo autorizado.

Guilherme (GitHub: `GuimaraesCRM`) é o único mantenedor com autoridade sobre qualquer pasta e os arquivos compartilhados. Somente um pedido explícito dele pode autorizar a IA a trabalhar fora de uma pasta de jogo; essa autorização vale apenas para a tarefa solicitada. A criação inicial destas regras e da estrutura compartilhada foi solicitada por ele.

## Organização de cada jogo

- Use uma pasta diretamente na raiz com o nome do jogo. Não organize os jogos pelo nome do autor.
- Mantenha implementação, recursos, manifestos, lockfiles, testes e documentação dentro dela.
- Crie um `README.md` local com jogo, responsável, estado de desenvolvimento, comandos de execução e validação e necessidades de multiplayer.
- Crie um `AGENTS.md` local com o responsável, o caminho autorizado e as instruções técnicas específicas. Ele deve reafirmar estas regras, nunca enfraquecê-las.
- Não escolha uma tecnologia comum, crie o launcher ou implemente o lobby central sem tarefa explícita de Guilherme.

## GitHub e conclusão de tarefas

- Siga `CONTRIBUTING.md`: verifique o estado local, busque atualizações, trabalhe em branch própria e preserve alterações existentes.
- Execute as verificações pertinentes dentro do jogo; confira o diff completo e os caminhos antes do commit.
- Ao concluir uma entrega solicitada, faça commit apenas dos arquivos autorizados e publique a branch no GitHub quando houver acesso. Use pull request para integração na branch principal; não faça merge nem push direto em `main` sem autorização de Guilherme.
- Não use force push, não reescreva histórico compartilhado e não publique credenciais, `.env`, dependências instaladas ou builds gerados.
- Se autenticação, conexão, conflitos ou permissões impedirem a publicação, preserve o trabalho e informe exatamente o que ficou pendente. Não diga que o GitHub está atualizado sem confirmação.
- Informe o que mudou, a validação realizada e a situação da publicação. Manter atualizado significa sincronizar as entregas; não prometer atividade automática fora da sessão.
