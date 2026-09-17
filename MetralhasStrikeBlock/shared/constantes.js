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
  ALTURA_AGACHADO: 1.35,
  OLHOS: 1.62,
  OLHOS_AGACHADO: 1.15
};

/**
 * As medidas do corpo, numa fonte de verdade só.
 *
 * O servidor monta as caixas de acerto com estes números e o cliente monta o
 * boneco com os mesmos — é o que impede o clássico "atirei na cabeça e não
 * contou": se cada lado tivesse a sua tabela, a cabeça desenhada e a cabeça
 * que o tiro procura acabariam em alturas diferentes.
 *
 * A cabeça é sempre a fatia do topo: `base = altura - ALTURA_CABECA`. Assim,
 * quando o jogador agacha e a altura cai, a cabeça desce junto em vez de
 * ficar boiando no ar.
 */
export const CORPO = {
  ALTURA_CABECA: 0.4,
  LARGURA_CABECA: 0.44,
  /** Altura do quadril, de onde pendem tronco e pernas. */
  QUADRIL: 0.85,
  QUADRIL_AGACHADO: 0.52
};

export function alturaDoCorpo(agachado) {
  return agachado ? FISICA.ALTURA_AGACHADO : FISICA.ALTURA;
}

export function alturaDosOlhos(agachado) {
  return agachado ? FISICA.OLHOS_AGACHADO : FISICA.OLHOS;
}

/**
 * As duas caixas de acerto de um jogador, em coordenadas do mundo.
 * `pos` são os pés. Corpo e cabeça se encostam sem sobrepor nem deixar vão.
 */
export function caixasDeAcerto(pos, agachado) {
  const altura = alturaDoCorpo(agachado);
  const meia = FISICA.LARGURA / 2;
  const meiaCabeca = CORPO.LARGURA_CABECA / 2;
  const baseCabeca = altura - CORPO.ALTURA_CABECA;

  return {
    corpo: {
      min: { x: pos.x - meia, y: pos.y, z: pos.z - meia },
      max: { x: pos.x + meia, y: pos.y + baseCabeca, z: pos.z + meia }
    },
    cabeca: {
      min: { x: pos.x - meiaCabeca, y: pos.y + baseCabeca, z: pos.z - meiaCabeca },
      max: { x: pos.x + meiaCabeca, y: pos.y + altura, z: pos.z + meiaCabeca }
    }
  };
}

/**
 * Duração das fases de um round, em segundos. São os valores padrão: o dono
 * da sala pode trocar o tempo de compra e de combate no lobby, dentro dos
 * limites abaixo.
 */
export const TEMPOS = {
  COMPRA: 15,
  COMBATE: 105,
  POS_ROUND: 5
};

/** Atalhos oferecidos no lobby, em segundos. */
export const DURACOES_COMBATE = [60, 105, 150, 210];
export const DURACOES_COMPRA = [5, 10, 15, 25];

export const LIMITE_COMBATE = { MINIMO: 30, MAXIMO: 300 };
export const LIMITE_COMPRA = { MINIMO: 3, MAXIMO: 60 };

/** Normaliza uma duração escolhida no lobby, ou devolve null se não servir. */
export function duracaoValida(bruto, limite) {
  const n = Math.round(Number(bruto));
  if (!Number.isFinite(n) || n < limite.MINIMO || n > limite.MAXIMO) return null;
  return n;
}

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
  MAX_CARREGADOS: 100
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
