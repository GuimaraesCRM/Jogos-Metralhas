import { test } from 'node:test';
import assert from 'node:assert/strict';

import { criarMundo, definirBloco, BLOCOS } from './mundo.js';
import { criarCorpo, criarGranada, passoGranada, passoJogador } from './fisica.js';
import { FISICA } from './constantes.js';

/** Mundo de teste: só um chão plano no y=0. */
function mundoPlano() {
  const mundo = criarMundo();
  for (let z = 0; z < mundo.tamZ; z++) {
    for (let x = 0; x < mundo.tamX; x++) {
      definirBloco(mundo, x, 0, z, BLOCOS.PISO);
    }
  }
  return mundo;
}

const PARADO = { frente: false, tras: false, esquerda: false, direita: false, pular: false, agachar: false };

test('jogador solto no ar cai e para em cima do chão', () => {
  const mundo = mundoPlano();
  const corpo = criarCorpo({ x: 10.5, y: 8, z: 10.5 });

  for (let i = 0; i < 120; i++) passoJogador(corpo, PARADO, 0, 1 / 60, mundo);

  assert.equal(corpo.pos.y, 1); // topo do bloco de chão
  assert.equal(corpo.noChao, true);
  assert.equal(corpo.vel.y, 0);
});

test('andar para a frente com yaw 0 move em -Z na velocidade de andar', () => {
  const mundo = mundoPlano();
  const corpo = criarCorpo({ x: 10.5, y: 1, z: 20.5 });

  passoJogador(corpo, { ...PARADO, frente: true }, 0, 1, mundo);

  assert.ok(Math.abs(corpo.pos.z - (20.5 - FISICA.VEL_ANDAR)) < 0.01);
  assert.ok(Math.abs(corpo.pos.x - 10.5) < 0.01);
});

test('agachado anda mais devagar', () => {
  const mundo = mundoPlano();
  const corpo = criarCorpo({ x: 10.5, y: 1, z: 20.5 });

  passoJogador(corpo, { ...PARADO, frente: true, agachar: true }, 0, 1, mundo);

  assert.ok(Math.abs(corpo.pos.z - (20.5 - FISICA.VEL_AGACHADO)) < 0.01);
});

test('parede segura o jogador — sem atravessar nem com dt grande', () => {
  const mundo = mundoPlano();
  // Parede de 3 de altura no z=15, na frente do jogador.
  for (let y = 1; y <= 3; y++) {
    for (let x = 0; x < mundo.tamX; x++) definirBloco(mundo, x, y, 15, BLOCOS.MURO);
  }
  const corpo = criarCorpo({ x: 10.5, y: 1, z: 18.5 });

  // dt de meio segundo seria movimento de 2,5 m num passo só; o fatiamento
  // interno precisa impedir o túnel pela parede.
  for (let i = 0; i < 10; i++) passoJogador(corpo, { ...PARADO, frente: true }, 0, 0.5, mundo);

  assert.ok(corpo.pos.z > 15.9, `deveria parar antes da parede, ficou em z=${corpo.pos.z}`);
});

test('pulo sobe, alcança mais de um bloco e volta ao chão', () => {
  const mundo = mundoPlano();
  const corpo = criarCorpo({ x: 10.5, y: 1, z: 10.5 });
  passoJogador(corpo, PARADO, 0, 0.1, mundo); // assenta e marca noChao

  let alturaMaxima = corpo.pos.y;
  passoJogador(corpo, { ...PARADO, pular: true }, 0, 1 / 60, mundo);
  for (let i = 0; i < 120; i++) {
    passoJogador(corpo, PARADO, 0, 1 / 60, mundo);
    alturaMaxima = Math.max(alturaMaxima, corpo.pos.y);
  }

  assert.ok(alturaMaxima > 2.0, `pulo subiu só até ${alturaMaxima}`);
  assert.equal(corpo.pos.y, 1);
  assert.equal(corpo.noChao, true);
});

test('pulando dá para subir um degrau de um bloco', () => {
  const mundo = mundoPlano();
  // Plataforma de 1 bloco de altura a partir do z=14 (borda em z=15).
  for (let z = 5; z <= 15; z++) {
    for (let x = 0; x < mundo.tamX; x++) definirBloco(mundo, x, 1, z, BLOCOS.DEGRAU);
  }
  const corpo = criarCorpo({ x: 10.5, y: 1, z: 17.2 });
  passoJogador(corpo, PARADO, 0, 0.1, mundo);

  // Pula e segue andando para a frente durante a subida.
  passoJogador(corpo, { ...PARADO, frente: true, pular: true }, 0, 1 / 60, mundo);
  for (let i = 0; i < 90; i++) {
    passoJogador(corpo, { ...PARADO, frente: true }, 0, 1 / 60, mundo);
  }

  assert.equal(corpo.pos.y, 2, `deveria estar sobre o degrau, está em y=${corpo.pos.y}`);
});

test('teto baixo interrompe o pulo', () => {
  const mundo = mundoPlano();
  // Teto no y=3 sobre a área do jogador: espaço livre de 2 blocos.
  for (let z = 8; z <= 12; z++) {
    for (let x = 8; x <= 12; x++) definirBloco(mundo, x, 3, z, BLOCOS.MURO);
  }
  const corpo = criarCorpo({ x: 10.5, y: 1, z: 10.5 });
  passoJogador(corpo, PARADO, 0, 0.1, mundo);

  passoJogador(corpo, { ...PARADO, pular: true }, 0, 1 / 60, mundo);
  let alturaMaxima = 0;
  for (let i = 0; i < 60; i++) {
    passoJogador(corpo, PARADO, 0, 1 / 60, mundo);
    alturaMaxima = Math.max(alturaMaxima, corpo.pos.y);
  }

  // Cabeça bate no teto: pés nunca passam de 3 - altura = 1,2.
  assert.ok(alturaMaxima <= 3 - FISICA.ALTURA + 0.01, `subiu até ${alturaMaxima}`);
});

test('granada quica e perde energia até assentar no chão', () => {
  const mundo = mundoPlano();
  const granada = criarGranada({ x: 10.5, y: 5, z: 10.5 }, { x: 0.3, y: -0.2, z: 0 });

  for (let i = 0; i < 300; i++) passoGranada(granada, 1 / 60, mundo);

  assert.ok(Math.abs(granada.vel.y) < 0.5, `ainda quicando: vel.y=${granada.vel.y}`);
  assert.ok(granada.pos.y > 1, 'não pode afundar no chão');
  assert.ok(granada.pos.y < 1.5, `deveria estar perto do chão, está em y=${granada.pos.y}`);
});

test('granada não atravessa parede: quica de volta', () => {
  const mundo = mundoPlano();
  for (let y = 1; y <= 5; y++) {
    for (let z = 0; z < mundo.tamZ; z++) definirBloco(mundo, 15, y, z, BLOCOS.MURO);
  }
  const granada = criarGranada({ x: 12.5, y: 2, z: 10.5 }, { x: 1, y: 0.1, z: 0 });

  for (let i = 0; i < 120; i++) passoGranada(granada, 1 / 60, mundo);

  assert.ok(granada.pos.x < 15, `atravessou a parede: x=${granada.pos.x}`);
});
