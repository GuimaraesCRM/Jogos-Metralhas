/**
 * Números que definem o jogo, num lugar só.
 *
 * Cliente e servidor importam este arquivo: a física que o jogador sente na
 * própria máquina precisa ser exatamente a mesma que o servidor usa para
 * validar posições e simular granadas.
 */

/** Dimensões do mundo em blocos. Y é a altura. */
export const MUNDO = { TAM_X: 64, TAM_Y: 32, TAM_Z: 64 };

/** Loop de simulação do servidor e taxa de fotos do estado para os clientes. */
export const TICK_HZ = 30;
export const SNAPSHOT_HZ = 20;

/** Física do jogador, em metros e segundos (1 bloco = 1 m). */
export const FISICA = {
  GRAVIDADE: 24,
  IMPULSO_PULO: 8,
  VEL_ANDAR: 5,
  VEL_AGACHADO: 2.4,
  LARGURA: 0.6,
  ALTURA: 1.8,
  OLHOS: 1.62,
  OLHOS_AGACHADO: 1.2
};

/** Duração das fases de um round, em segundos. */
export const TEMPOS = {
  COMPRA: 15,
  COMBATE: 105,
  POS_ROUND: 5
};

/** Fases possíveis de uma partida. */
export const FASES = {
  COMPRA: 'compra',
  COMBATE: 'combate',
  POS_ROUND: 'pos_round',
  FIM: 'fim'
};

/** Economia estilo CS: dinheiro inicial, teto e bônus de fim de round. */
export const ECONOMIA = {
  INICIAL: 800,
  TETO: 10000,
  VITORIA: 3000,
  DERROTA: 1900
};

export const PARTIDA = {
  ROUNDS_PARA_VENCER: 8,
  /** Depois deste round os times trocam de lado e a economia zera. */
  TROCA_DE_LADO_APOS: 7,
  HP_MAXIMO: 100,
  COLETE_MAXIMO: 100,
  MIN_POR_TIME: 1,
  MAX_POR_TIME: 8
};

/** Blocos colocados por jogadores durante o round. */
export const BLOCO_JOGADOR = {
  HP: 60,
  ALCANCE: 4,
  MAX_CARREGADOS: 30
};

/** Granada HE. */
export const GRANADA = {
  VELOCIDADE: 18,
  PAVIO_S: 1.8,
  DANO: 70,
  RAIO: 5,
  RESTITUICAO: 0.45,
  RAIO_CORPO: 0.15
};

export const TIMES = { AZUL: 'azul', VERMELHO: 'vermelho' };

export const ROTULO_TIME = {
  [TIMES.AZUL]: 'Time Azul',
  [TIMES.VERMELHO]: 'Time Vermelho'
};

export function timeOposto(time) {
  return time === TIMES.AZUL ? TIMES.VERMELHO : TIMES.AZUL;
}

/** Frequência com que o cliente reporta posição e recebe fotos, derivadas. */
export const INTERVALO_TICK_MS = 1000 / TICK_HZ;
export const INTERVALO_SNAPSHOT_MS = 1000 / SNAPSHOT_HZ;

/** Atraso da interpolação dos outros jogadores no cliente, em ms. */
export const ATRASO_INTERPOLACAO_MS = 100;
