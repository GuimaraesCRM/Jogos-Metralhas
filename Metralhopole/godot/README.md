# Metralhopole 3D — Godot 4

Cliente nativo da Metralhopole em Godot 4.7.2.

- Tabuleiro de 60 casas em geometria 3D.
- Personagem GLB dentro do mesmo mundo e movimento casa por casa (`M`).
- Câmera orbital por arraste e zoom pela roda.
- Dois dados `RigidBody3D` com gravidade, impulso e colisão (`Espaço`).
- Iluminação, sombras e profundidade compartilhadas.
- Criação, entrada e reconexão de salas pelo servidor autoritativo existente.
- Jogadores e personagens exclusivos sincronizados online.
- Ações de turno, prisão, compra, melhorias, aluguel, cartas, pausa, venda ao banco e negociações.
- Tabuleiros próprios para partidas de quatro ou oito jogadores.
- Casas e hotel GLB posicionados sobre as propriedades.

Abra `project.godot` no Godot ou execute o editor com `--path godot`. Para gerar a distribuição Windows, execute `powershell -ExecutionPolicy Bypass -File godot/build-windows.ps1` a partir da pasta `Metralhopole`; o script exporta o jogo e inclui o servidor Node na pasta `godot/build`.
