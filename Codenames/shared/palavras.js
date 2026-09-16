/**
 * Banco de palavras em português do Brasil.
 *
 * Critério de escolha: substantivos comuns, no singular, que qualquer adulto
 * reconhece — e de preferencia com mais de um sentido ou muitas associacoes
 * possíveis. Palavra de sentido único e travada rende dica ruim; é justamente
 * a ambiguidade que faz o jogo funcionar.
 */

export const PALAVRAS = [
  // Animais
  'ABELHA', 'ÁGUIA', 'ARANHA', 'BALEIA', 'BORBOLETA', 'CACHORRO', 'CAMELO',
  'CANGURU', 'CARANGUEJO', 'CAVALO', 'COBRA', 'CORUJA', 'ELEFANTE', 'FORMIGA',
  'GALO', 'GATO', 'GOLFINHO', 'JACARÉ', 'LEÃO', 'LOBO', 'MACACO', 'MORCEGO',
  'PATO', 'PAVÃO', 'PEIXE', 'PINGUIM', 'POLVO', 'RAPOSA', 'RATO', 'SAPO',
  'TARTARUGA', 'TIGRE', 'TUBARÃO', 'URSO', 'VACA',

  // Objetos do dia a dia
  'AGULHA', 'ÂNCORA', 'ANEL', 'BALDE', 'BANDEIRA', 'BOTÃO', 'BÚSSOLA',
  'CADEIRA', 'CANETA', 'CHAVE', 'COLHER', 'CORDA', 'CORRENTE', 'COROA',
  'ESCADA', 'ESCOVA', 'ESPADA', 'ESPELHO', 'FACA', 'GARRAFA', 'GRAVATA',
  'JANELA', 'LÂMPADA', 'LIVRO', 'LUPA', 'MALA', 'MARTELO', 'MÁSCARA',
  'MOEDA', 'ÓCULOS', 'PENTE', 'PILHA', 'PRATO', 'RELÓGIO', 'SINO', 'TAMBOR',
  'TESOURA', 'VASSOURA', 'VELA',

  // Lugares
  'ADEGA', 'ALDEIA', 'BANCO', 'BIBLIOTECA', 'CAMPO', 'CASTELO', 'CAVERNA',
  'CEMITÉRIO', 'CIDADE', 'DESERTO', 'ESCOLA', 'ESTÁDIO', 'FAROL', 'FEIRA',
  'FLORESTA', 'FRONTEIRA', 'HOSPITAL', 'HOTEL', 'IGREJA', 'ILHA', 'LABIRINTO',
  'MERCADO', 'MUSEU', 'PALCO', 'PARQUE', 'PIRÂMIDE', 'PONTE', 'PORTO',
  'PRAIA', 'PRISÃO', 'QUARTO', 'TEATRO', 'TORRE', 'TÚNEL', 'VULCÃO',

  // Comidas e bebidas
  'ABACAXI', 'ALHO', 'ARROZ', 'AZEITE', 'BISCOITO', 'BOLO', 'CAFÉ', 'CALDO',
  'CANELA', 'CARNE', 'CASTANHA', 'CEBOLA', 'CHOCOLATE', 'FARINHA', 'FEIJÃO',
  'LIMÃO', 'MANTEIGA', 'MEL', 'MELANCIA', 'MOSTARDA', 'OVO', 'PÃO', 'PIMENTA',
  'QUEIJO', 'SAL', 'SOPA', 'SORVETE', 'SUCO', 'UVA', 'VINHO',

  // Corpo humano
  'BARBA', 'BOCA', 'BRAÇO', 'CABEÇA', 'CABELO', 'CÉREBRO', 'CINTURA',
  'CORAÇÃO', 'COSTELA', 'DEDO', 'DENTE', 'GARGANTA', 'JOELHO', 'LÍNGUA',
  'MÃO', 'NARIZ', 'OLHO', 'OMBRO', 'ORELHA', 'OSSO', 'PELE', 'PULMÃO',
  'PUNHO', 'SANGUE', 'UNHA', 'VEIA',

  // Natureza
  'AREIA', 'ÁRVORE', 'CACHOEIRA', 'CHUVA', 'ESPINHO', 'ESTRELA', 'FOGO',
  'FOLHA', 'FUMAÇA', 'GELO', 'LUA', 'MARÉ', 'MONTANHA', 'NEVE', 'NUVEM',
  'ONDA', 'ORVALHO', 'PÂNTANO', 'PEDRA', 'PENHASCO', 'RAIO', 'RAIZ', 'RIO',
  'SEMENTE', 'SOL', 'SOMBRA', 'TEMPESTADE', 'TERRA', 'TRONCO', 'VENTO',

  // Profissões e personagens
  'ADVOGADO', 'ARQUITETO', 'ASTRONAUTA', 'BOMBEIRO', 'BRUXA', 'CAÇADOR',
  'CARTEIRO', 'COZINHEIRO', 'DENTISTA', 'DETETIVE', 'ENFERMEIRA', 'ENGENHEIRO',
  'ESPIÃO', 'FOTÓGRAFO', 'GUARDA', 'JARDINEIRO', 'JUIZ', 'LADRÃO', 'MÁGICO',
  'MARINHEIRO', 'MÉDICO', 'MERGULHADOR', 'MINEIRO', 'MOTORISTA', 'PADEIRO',
  'PALHAÇO', 'PESCADOR', 'PILOTO', 'PINTOR', 'POLICIAL', 'PROFESSOR',
  'RAINHA', 'REI', 'SOLDADO',

  // Transporte e tecnologia
  'ANTENA', 'AVIÃO', 'BALÃO', 'BARCO', 'BATERIA', 'BICICLETA', 'CABO',
  'CÂMERA', 'CAMINHÃO', 'CANOA', 'CARRO', 'COMPUTADOR', 'FOGUETE',
  'HELICÓPTERO', 'IMPRESSORA', 'MOTO', 'MOTOR', 'NAVIO', 'ÔNIBUS',
  'PARAQUEDAS', 'RÁDIO', 'REDE', 'ROBÔ', 'RODA', 'SATÉLITE', 'SENHA',
  'SUBMARINO', 'TECLADO', 'TELEFONE', 'TELESCÓPIO', 'TREM', 'TRILHO',
  'VELEIRO',

  // Ideias, histórias e outros
  'ALARME', 'ANJO', 'BEIJO', 'CIRCO', 'CÍRCULO', 'CÓDIGO', 'CONTA',
  'DIAMANTE', 'DRAGÃO', 'FANTASMA', 'FESTA', 'FILME', 'GIGANTE', 'GUERRA',
  'HISTÓRIA', 'JOGO', 'LENDA', 'LETRA', 'MÁQUINA', 'MISTÉRIO', 'MÚMIA',
  'MÚSICA', 'NOTA', 'ORQUESTRA', 'PALAVRA', 'PARTIDA', 'PLANO', 'PONTO',
  'PRESENTE', 'RISCO', 'SEGREDO', 'SEREIA', 'SINAL', 'SONHO', 'SORTE',
  'TEMPO', 'TRUQUE', 'VAMPIRO', 'VOZ'
];

export default PALAVRAS;
