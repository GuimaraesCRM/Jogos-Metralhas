import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MUNDO, TIMES } from './constantes.js';
import { BLOCOS, ehSolido, linhaLivre, obterBloco } from './mundo.js';
import { SPAWNS, ZONA_BASE, dentroDaZona, direcaoDoOlhar, gerarArena, olhosDoSpawn } from './mapa.js';

test('a arena tem as dimensões combinadas e é determinística', () => {
  const a = gerarArena();
  const b = gerarArena();
  assert.equal(a.tamX, MUNDO.TAM_X);
  assert.equal(a.tamY, MUNDO.TAM_Y);
  assert.equal(a.tamZ, MUNDO.TAM_Z);
  assert.deepEqual(a.blocos, b.blocos);
});

test('cada spawn nasce no ar, com chão sólido embaixo e dentro da própria base', () => {
  const mundo = gerarArena();
  for (const time of [TIMES.AZUL, TIMES.VERMELHO]) {
    assert.equal(SPAWNS[time].length, 8);
    for (const spawn of SPAWNS[time]) {
      const x = Math.floor(spawn.x);
      const z = Math.floor(spawn.z);
      // Espaço para o corpo (2 blocos de altura livres).
      assert.equal(obterBloco(mundo, x, 1, z), BLOCOS.AR, `spawn ${time} em ${x},${z}`);
      assert.equal(obterBloco(mundo, x, 2, z), BLOCOS.AR);
      assert.ok(ehSolido(obterBloco(mundo, x, 0, z)), 'precisa de chão embaixo');
      assert.ok(dentroDaZona(ZONA_BASE[time], spawn), 'spawn fora da zona da base');
    }
  }
});

test('nenhum spawn azul enxerga um spawn vermelho (nem o contrário)', () => {
  const mundo = gerarArena();
  for (const azul of SPAWNS[TIMES.AZUL]) {
    for (const vermelho of SPAWNS[TIMES.VERMELHO]) {
      const livre = linhaLivre(mundo, olhosDoSpawn(azul), olhosDoSpawn(vermelho));
      assert.equal(
        livre,
        false,
        `linha de visão aberta entre azul z=${azul.z} e vermelho z=${vermelho.z}`
      );
    }
  }
});

test('a torre central existe e tem escada que sobe de 1 em 1 bloco', () => {
  const mundo = gerarArena();
  // Plataforma 4×4 no y=4.
  for (let z = 30; z <= 33; z++) {
    for (let x = 30; x <= 33; x++) {
      assert.equal(obterBloco(mundo, x, 4, z), BLOCOS.TORRE, `plataforma em ${x},${z}`);
    }
  }
  // Cada degrau é 1 mais alto que o anterior (pulo alcança 1,33 m).
  const topoDoDegrau = (z) => {
    for (let y = MUNDO.TAM_Y - 1; y >= 0; y--) {
      if (obterBloco(mundo, 31, y, z) !== BLOCOS.AR) return y;
    }
    return -1;
  };
  assert.equal(topoDoDegrau(37), 1);
  assert.equal(topoDoDegrau(36), 2);
  assert.equal(topoDoDegrau(35), 3);
  assert.equal(topoDoDegrau(34), 4);
});

test('as bases têm portões abertos nos muros', () => {
  const mundo = gerarArena();
  // Um caminho pelo portão azul (z=15) e um pelo vermelho (z=23).
  assert.equal(obterBloco(mundo, 14, 1, 15), BLOCOS.AR);
  assert.equal(obterBloco(mundo, 14, 2, 15), BLOCOS.AR);
  assert.equal(obterBloco(mundo, 49, 1, 23), BLOCOS.AR);
  assert.equal(obterBloco(mundo, 49, 2, 23), BLOCOS.AR);
  // E fora do portão o muro está lá.
  assert.equal(obterBloco(mundo, 14, 1, 30), BLOCOS.BASE_AZUL);
  assert.equal(obterBloco(mundo, 49, 1, 30), BLOCOS.BASE_VERMELHA);
});

test('as zonas de base não se sobrepõem e o meio não pertence a ninguém', () => {
  const meio = { x: 32, y: 1, z: 32 };
  assert.equal(dentroDaZona(ZONA_BASE[TIMES.AZUL], meio), false);
  assert.equal(dentroDaZona(ZONA_BASE[TIMES.VERMELHO], meio), false);
  for (const spawn of SPAWNS[TIMES.AZUL]) {
    assert.equal(dentroDaZona(ZONA_BASE[TIMES.VERMELHO], spawn), false);
  }
});

test('direcaoDoOlhar segue a convenção: yaw 0 aponta para -Z', () => {
  const frente = direcaoDoOlhar(0, 0);
  assert.ok(Math.abs(frente.x) < 1e-9 && Math.abs(frente.z + 1) < 1e-9);

  // Spawns azuis olham para +X (o meio do mapa).
  const azul = direcaoDoOlhar(SPAWNS[TIMES.AZUL][0].yaw, 0);
  assert.ok(azul.x > 0.99);

  const cima = direcaoDoOlhar(0, Math.PI / 2);
  assert.ok(cima.y > 0.99);
});
