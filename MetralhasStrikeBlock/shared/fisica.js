/**
 * Física de jogador e de granada, em funções puras.
 *
 * Roda no cliente (o movimento do próprio jogador precisa responder no mesmo
 * frame, sem esperar o servidor) e no servidor (granadas e validação de
 * posições). Por isso vive em shared/ e não pode importar nada de interface.
 *
 * Colisão no esquema Minecraft clássico: move um eixo por vez e, se a caixa do
 * jogador invadir um bloco, encosta na face do bloco e zera a velocidade
 * daquele eixo. É simples e não deixa atravessar parede — o que basta.
 */

import { FISICA, GRANADA, alturaDosOlhos } from './constantes.js';
import { caixaColide } from './mundo.js';

const EPS = 1e-3;

/** Passo máximo de integração: dt maiores são fatiados para não atravessar bloco. */
const SUBPASSO = 1 / 60;

/** Queda livre não passa disso — evita atravessar o chão num tick atrasado. */
const VEL_QUEDA_MAX = 40;

export function criarCorpo(pos) {
  return {
    pos: { x: pos.x, y: pos.y, z: pos.z },
    vel: { x: 0, y: 0, z: 0 },
    noChao: false
  };
}

/** Reexporta a medida das constantes: a altura do olho tem uma fonte só. */
export { alturaDosOlhos };

/**
 * Um passo de simulação do jogador.
 * `comandos`: { frente, tras, esquerda, direita, pular, agachar } (booleanos).
 * O yaw define para onde "frente" aponta; o pitch não afeta o movimento.
 */
export function passoJogador(corpo, comandos, yaw, dt, mundo) {
  let restante = dt;
  while (restante > 1e-9) {
    const passo = Math.min(restante, SUBPASSO);
    subPassoJogador(corpo, comandos, yaw, passo, mundo);
    restante -= passo;
  }
  return corpo;
}

function subPassoJogador(corpo, comandos, yaw, dt, mundo) {
  const { pos, vel } = corpo;

  // Direção desejada no plano, no referencial da câmera (yaw 0 olha para -Z).
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  // Vetor "direita" é a frente girada 90° no sentido horário visto de cima.
  const dx = -fz;
  const dz = fx;

  let mx = 0;
  let mz = 0;
  if (comandos.frente) {
    mx += fx;
    mz += fz;
  }
  if (comandos.tras) {
    mx -= fx;
    mz -= fz;
  }
  if (comandos.direita) {
    mx += dx;
    mz += dz;
  }
  if (comandos.esquerda) {
    mx -= dx;
    mz -= dz;
  }

  const comprimento = Math.hypot(mx, mz);
  const velAlvo = comandos.agachar ? FISICA.VEL_AGACHADO : FISICA.VEL_ANDAR;
  if (comprimento > 0) {
    vel.x = (mx / comprimento) * velAlvo;
    vel.z = (mz / comprimento) * velAlvo;
  } else {
    vel.x = 0;
    vel.z = 0;
  }

  if (comandos.pular && corpo.noChao) {
    vel.y = FISICA.IMPULSO_PULO;
    corpo.noChao = false;
  }

  vel.y = Math.max(vel.y - FISICA.GRAVIDADE * dt, -VEL_QUEDA_MAX);

  const L = FISICA.LARGURA;
  const A = FISICA.ALTURA;
  const meia = L / 2;

  // --- eixo X ---------------------------------------------------------------
  pos.x += vel.x * dt;
  if (caixaColide(mundo, pos, L, A)) {
    if (vel.x > 0) pos.x = Math.floor(pos.x + meia) - meia - EPS;
    else pos.x = Math.floor(pos.x - meia) + 1 + meia + EPS;
    vel.x = 0;
  }

  // --- eixo Z ---------------------------------------------------------------
  pos.z += vel.z * dt;
  if (caixaColide(mundo, pos, L, A)) {
    if (vel.z > 0) pos.z = Math.floor(pos.z + meia) - meia - EPS;
    else pos.z = Math.floor(pos.z - meia) + 1 + meia + EPS;
    vel.z = 0;
  }

  // --- eixo Y ---------------------------------------------------------------
  pos.y += vel.y * dt;
  corpo.noChao = false;
  if (caixaColide(mundo, pos, L, A)) {
    if (vel.y <= 0) {
      // Aterrissou: encosta os pés no topo do bloco invadido.
      pos.y = Math.floor(pos.y) + 1;
      // Blocos empilhados num tick fatiado grande: sobe até desencaixar.
      let seguranca = 4;
      while (caixaColide(mundo, pos, L, A) && seguranca-- > 0) pos.y += 1;
      corpo.noChao = true;
    } else {
      // Bateu a cabeça.
      pos.y = Math.floor(pos.y + A) - A - EPS;
    }
    vel.y = 0;
  } else if (vel.y <= 0) {
    // Parado ou descendo sem colisão: confere se há chão logo abaixo, senão o
    // jogador "gruda" no ar depois de aterrissar uma vez.
    const sonda = { x: pos.x, y: pos.y - 2 * EPS, z: pos.z };
    corpo.noChao = caixaColide(mundo, sonda, L, A);
  }

  // Rede de segurança: nada cai para fora do mundo.
  if (pos.y < 0) {
    pos.y = 1;
    vel.y = 0;
  }
}

// ----------------------------------------------------------------- granada

export function criarGranada(origem, direcao, velocidade = GRANADA.VELOCIDADE) {
  const c = Math.hypot(direcao.x, direcao.y, direcao.z) || 1;
  return {
    pos: { x: origem.x, y: origem.y, z: origem.z },
    vel: {
      x: (direcao.x / c) * velocidade,
      y: (direcao.y / c) * velocidade,
      z: (direcao.z / c) * velocidade
    }
  };
}

/**
 * Um passo da granada: gravidade + quique com perda de energia. A granada é
 * uma caixinha (2·raio) para reaproveitar a mesma colisão do jogador.
 */
export function passoGranada(granada, dt, mundo) {
  let restante = dt;
  while (restante > 1e-9) {
    const passo = Math.min(restante, SUBPASSO);
    subPassoGranada(granada, passo, mundo);
    restante -= passo;
  }
  return granada;
}

function subPassoGranada(granada, dt, mundo) {
  const { pos, vel } = granada;
  const R = GRANADA.RAIO_CORPO;
  const lado = R * 2;
  // caixaColide mede a partir dos pés: desloca meia altura para baixo.
  const caixa = (p) => caixaColide(mundo, { x: p.x, y: p.y - R, z: p.z }, lado, lado);

  vel.y = Math.max(vel.y - FISICA.GRAVIDADE * dt, -VEL_QUEDA_MAX);

  const quicar = (eixo) => {
    vel[eixo] = -vel[eixo] * GRANADA.RESTITUICAO;
    // Atrito nos outros eixos a cada quique, para a granada assentar.
    for (const outro of ['x', 'y', 'z']) {
      if (outro !== eixo) vel[outro] *= 0.8;
    }
  };

  pos.x += vel.x * dt;
  if (caixa(pos)) {
    pos.x -= vel.x * dt;
    quicar('x');
  }
  pos.z += vel.z * dt;
  if (caixa(pos)) {
    pos.z -= vel.z * dt;
    quicar('z');
  }
  pos.y += vel.y * dt;
  if (caixa(pos)) {
    pos.y -= vel.y * dt;
    quicar('y');
    // Quique fraco no chão vira repouso, senão ela treme para sempre.
    if (Math.abs(vel.y) < 1) vel.y = 0;
  }

  if (pos.y < R) {
    pos.y = R;
    vel.y = 0;
  }
}
