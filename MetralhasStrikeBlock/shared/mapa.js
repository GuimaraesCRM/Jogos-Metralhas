/**
 * O mapa da arena, gerado por código.
 *
 * Determinístico de propósito: cliente e servidor chamam `gerarArena()` e
 * chegam ao MESMO mundo sem trafegar um byte de mapa. Só os blocos colocados
 * por jogadores durante a partida viajam pela rede.
 *
 * A geometria segue duas regras de desenho:
 *  - nenhum spawn enxerga um spawn inimigo (portões desalinhados + chicanas
 *    na frente de cada portão, todas mais altas que a linha dos olhos);
 *  - a torre central é a posição forte de sniper, mas é disputável: a escada
 *    sobe pelo lado sul, exposta aos dois times.
 */

import { MUNDO, FISICA, TIMES } from './constantes.js';
import { criarMundo, definirBloco, BLOCOS } from './mundo.js';

const { TAM_X, TAM_Z } = MUNDO;

/** Preenche um paralelepípedo de blocos (limites inclusivos). */
function encher(mundo, x0, y0, z0, x1, y1, z1, id) {
  for (let y = y0; y <= y1; y++) {
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        definirBloco(mundo, x, y, z, id);
      }
    }
  }
}

// Muros de base com portões em faixas de z DIFERENTES de cada lado: sem um
// corredor reto de spawn a spawn.
const MURO_AZUL_X = 14;
const MURO_VERMELHO_X = 49;
const PORTOES_AZUL = [
  [14, 17],
  [46, 49]
];
const PORTOES_VERMELHO = [
  [22, 25],
  [38, 41]
];

export function gerarArena() {
  const mundo = criarMundo();

  // Piso e borda externa (h=6: mais alta que qualquer pulo).
  encher(mundo, 0, 0, 0, TAM_X - 1, 0, TAM_Z - 1, BLOCOS.PISO);
  encher(mundo, 0, 1, 0, TAM_X - 1, 6, 0, BLOCOS.MURO);
  encher(mundo, 0, 1, TAM_Z - 1, TAM_X - 1, 6, TAM_Z - 1, BLOCOS.MURO);
  encher(mundo, 0, 1, 0, 0, 6, TAM_Z - 1, BLOCOS.MURO);
  encher(mundo, TAM_X - 1, 1, 0, TAM_X - 1, 6, TAM_Z - 1, BLOCOS.MURO);

  // Muros das bases (h=4) com portões.
  const muroComPortoes = (x, portoes, id) => {
    encher(mundo, x, 1, 1, x, 4, TAM_Z - 2, id);
    for (const [z0, z1] of portoes) {
      encher(mundo, x, 1, z0, x, 4, z1, BLOCOS.AR);
    }
  };
  muroComPortoes(MURO_AZUL_X, PORTOES_AZUL, BLOCOS.BASE_AZUL);
  muroComPortoes(MURO_VERMELHO_X, PORTOES_VERMELHO, BLOCOS.BASE_VERMELHA);

  // Chicanas (h=3, acima da linha dos olhos): quem sai por um portão precisa
  // dobrar, e nenhuma reta atravessa portão + chicana.
  encher(mundo, MURO_AZUL_X + 3, 1, 11, MURO_AZUL_X + 3, 3, 20, BLOCOS.MURO);
  encher(mundo, MURO_AZUL_X + 3, 1, 43, MURO_AZUL_X + 3, 3, 52, BLOCOS.MURO);
  encher(mundo, MURO_VERMELHO_X - 3, 1, 19, MURO_VERMELHO_X - 3, 3, 28, BLOCOS.MURO);
  encher(mundo, MURO_VERMELHO_X - 3, 1, 35, MURO_VERMELHO_X - 3, 3, 44, BLOCOS.MURO);

  // Paredes quebra-visão no meio, deslocadas uma da outra.
  encher(mundo, 22, 1, 20, 22, 3, 30, BLOCOS.MURO);
  encher(mundo, 41, 1, 34, 41, 3, 44, BLOCOS.MURO);

  // Muretas de flanco (h=2): cobertura de agachar nos corredores laterais.
  encher(mundo, 24, 1, 12, 40, 2, 12, BLOCOS.MURO);
  encher(mundo, 24, 1, 52, 40, 2, 52, BLOCOS.MURO);

  // Caixas 2×2×2 espalhadas no meio.
  const caixas = [
    [24, 30],
    [27, 34],
    [36, 29],
    [39, 33],
    [31, 22],
    [31, 44]
  ];
  for (const [cx, cz] of caixas) {
    encher(mundo, cx, 1, cz, cx + 1, 2, cz + 1, BLOCOS.CAIXA);
  }

  // Torre central: plataforma 4×4 no y=4 sobre pilares, com escada ao sul.
  encher(mundo, 30, 4, 30, 33, 4, 33, BLOCOS.TORRE);
  for (const [px, pz] of [[30, 30], [33, 30], [30, 33], [33, 33]]) {
    encher(mundo, px, 1, pz, px, 3, pz, BLOCOS.TORRE);
  }
  // Degraus de altura crescente: dá para subir pulando de um para o outro.
  encher(mundo, 31, 1, 37, 32, 1, 37, BLOCOS.DEGRAU);
  encher(mundo, 31, 1, 36, 32, 2, 36, BLOCOS.DEGRAU);
  encher(mundo, 31, 1, 35, 32, 3, 35, BLOCOS.DEGRAU);
  encher(mundo, 31, 1, 34, 32, 4, 34, BLOCOS.DEGRAU);

  return mundo;
}

// Convenção de olhar do jogo inteiro: yaw 0 aponta para -Z e cresce para a
// esquerda; pitch positivo olha para cima.
//   direção = (-sin(yaw)·cos(pitch), sin(pitch), -cos(yaw)·cos(pitch))
export function direcaoDoOlhar(yaw, pitch) {
  const cp = Math.cos(pitch);
  return { x: -Math.sin(yaw) * cp, y: Math.sin(pitch), z: -Math.cos(yaw) * cp };
}

const YAW_PARA_MAIS_X = -Math.PI / 2;
const YAW_PARA_MENOS_X = Math.PI / 2;

const spawnsEm = (x, yaw) =>
  [8, 14, 20, 26, 38, 44, 50, 56].map((z) => ({ x: x + 0.5, y: 1, z: z + 0.5, yaw }));

/** Oito pontos de nascimento por time, dentro da base, virados para o meio. */
export const SPAWNS = {
  [TIMES.AZUL]: spawnsEm(6, YAW_PARA_MAIS_X),
  [TIMES.VERMELHO]: spawnsEm(57, YAW_PARA_MENOS_X)
};

/**
 * A base de cada time: zona de compra e área onde o time fica preso durante o
 * freeze time. Limites contínuos (a parede da base fica no plano x = x1/x0).
 */
export const ZONA_BASE = {
  [TIMES.AZUL]: { x0: 1, x1: MURO_AZUL_X, z0: 1, z1: TAM_Z - 1 },
  [TIMES.VERMELHO]: { x0: MURO_VERMELHO_X + 1, x1: TAM_X - 1, z0: 1, z1: TAM_Z - 1 }
};

export function dentroDaZona(zona, pos) {
  return pos.x >= zona.x0 && pos.x <= zona.x1 && pos.z >= zona.z0 && pos.z <= zona.z1;
}

/** Posição dos olhos num spawn — os testes de linha de visão usam isto. */
export function olhosDoSpawn(spawn) {
  return { x: spawn.x, y: spawn.y + FISICA.OLHOS, z: spawn.z };
}
