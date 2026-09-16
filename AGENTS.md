# Instruções obrigatórias para agentes de IA

## Objetivo

Este repositório contém o futuro bundle Jogos Metralhas: vários jogos independentes para amigos jogarem online, incluindo possíveis Codenames e Spyfall. Posteriormente, um mega launcher com executável central reunirá seleção e inicialização dos jogos, lobby online, convites, lista de amigos, criação e entrada em salas e outros recursos compartilhados. Não implementar essa infraestrutura como efeito colateral do trabalho em um jogo.

## Liberdade de tecnologia

- Priorize jogos distribuídos como executáveis desktop, com janela própria e sem exigir que o jogador abra ou instale um navegador. Para o ambiente atual, priorize Windows (`.exe`). Uma versão que rode apenas em navegador não é a entrega padrão; trate uma versão web como alternativa somente quando solicitada explicitamente.
- A escolha da tecnologia continua livre. Tecnologias web podem ser usadas internamente, desde que empacotadas como aplicativo desktop com os componentes necessários. O jogador não deve precisar instalar ferramentas de desenvolvimento para executar a versão distribuída.
- Documente como executar em desenvolvimento e como gerar e usar o executável. Dependências de rede ou de um servidor multiplayer devem ser informadas separadamente: ter um executável não significa dispensar o servidor online.
- Não há linguagem, engine, framework ou stack obrigatória para todos os jogos. Cada responsável pode escolher a tecnologia do próprio jogo; jogos diferentes podem usar tecnologias completamente diferentes.
- Não impor a tecnologia de um jogo a outro, nem migrar ou reescrever jogos para uniformizar o bundle. A futura integração deve respeitar essa independência.
- Manter dependências, configurações e ferramentas específicas dentro da pasta do jogo. Documentar tecnologias, versões necessárias, execução, build, validação, requisitos de rede e pontos de entrada no README local.
- Desenvolver e testar o jogo isoladamente. A tecnologia do launcher e os contratos de integração serão definidos posteriormente; não inventar agora um protocolo obrigatório para todos os jogos.
- O executável central poderá iniciar jogos com runtimes ou processos distintos e usar adaptadores definidos na integração. Não presumir que todos os jogos devem compartilhar runtime ou ser compilados em um único binário.

## Identidade e escopo antes de editar

1. Leia este arquivo, `RESPONSAVEIS.md` e as instruções específicas da pasta autorizada.
2. Identifique o colaborador e o jogo da tarefa. Não use apenas o nome local do computador ou o autor configurado no Git como prova de identidade.
3. Confira a atribuição em `RESPONSAVEIS.md`. Para jogos existentes, a atribuição é obrigatória. Para um jogo novo ainda não cadastrado, siga a exceção de primeiro PR abaixo. Se houver ambiguidade sobre identidade, pasta ou responsável, ou a tarefa envolver mais de um jogo, esclareça o escopo antes de editar.
4. Uma tarefa de jogo autoriza alterações somente na pasta desse jogo, cujo nome deve ser o nome do jogo. Isso inclui arquivos novos, exclusões, renomeações, formatação, assets, testes, dependências e arquivos gerados.

## Primeiro PR de um jogo novo

- O colaborador pode iniciar um jogo e enviar seu primeiro PR sem cadastro prévio em `RESPONSAVEIS.md`, inclusive por fork.
- Identifique o colaborador, seu usuário GitHub e o nome do jogo. Confira a `main` atualizada: a pasta deve ser nova na raiz, ter o nome do jogo e não estar cadastrada ou ocupada por outro jogo. Não reutilize uma pasta existente sem atribuição.
- Essa exceção autoriza somente a criação e o desenvolvimento dentro da nova pasta proposta, incluindo ajustes no mesmo PR durante a revisão. Não autoriza alterações em arquivos existentes fora dela, outros jogos, regras ou cadastro de responsáveis.
- No `README.md` e no `AGENTS.md` locais, registre o autor proposto, seu usuário GitHub, a pasta e a situação de cadastro pendente. No PR, informe esses mesmos dados e o que está sendo desenvolvido.
- Guilherme revisa a proposta, cadastra manualmente o responsável em `RESPONSAVEIS.md` e aprova o PR antes da integração. Abrir um PR não reserva automaticamente o jogo nem concede responsabilidade definitiva. Se houver propostas conflitantes, encaminhe a decisão a Guilherme.
- Após a integração, vale a atribuição cadastrada. A ausência de cadastro em um jogo já existente não permite usar esta exceção para assumir sua pasta.

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
- Ao concluir uma entrega solicitada, faça commit apenas dos arquivos autorizados e publique a branch no GitHub quando houver acesso. Todos podem abrir pull requests, inclusive por forks, mas a integração em `main` exige aprovação explícita de Guilherme (`@GuimaraesCRM`). Aprovação de outro colaborador não substitui a dele. Novos commits que alterem o diff exigem nova aprovação.
- Não aprove pull requests em nome de Guilherme, não faça merge nem use privilégios administrativos para contornar a revisão sem pedido explícito dele para aquela ação. O acesso autenticado à conta dele não constitui aprovação de um pull request.
- Não use force push, não reescreva histórico compartilhado e não publique credenciais, `.env`, dependências instaladas ou builds gerados.
- Se autenticação, conexão, conflitos ou permissões impedirem a publicação, preserve o trabalho e informe exatamente o que ficou pendente. Não diga que o GitHub está atualizado sem confirmação.
- Informe o que mudou, a validação realizada e a situação da publicação. Manter atualizado significa sincronizar as entregas; não prometer atividade automática fora da sessão.
