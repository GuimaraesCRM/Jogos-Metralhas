/**
 * As medidas do corpo: o que o servidor procura com o tiro tem de ser onde o
 * cliente desenha o boneco.
 *
 * Estes testes existem porque o descasamento já aconteceu de verdade: a
 * cabeça era desenhada de 1,48 a 1,90 e a caixa de acerto ficava de 1,40 a
 * 1,80. O resultado era tiro no topo da cabeça não contando e tiro no pescoço
 * contando como headshot.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CORPO, FISICA, alturaDoCorpo, alturaDosOlhos, caixasDeAcerto } from './constantes.js';

/** Medidas derivadas de somas de frações binárias não fecham exatas. */
function quase(a, b, mensagem) {
  assert.ok(Math.abs(a - b) < 1e-9, `${mensagem ?? 'valores diferentes'}: ${a} vs ${b}`);
}

const PES = { x: 10, y: 5, z: 20 };

test('em pé: as caixas cobrem o corpo inteiro, sem vão nem sobreposição', () => {
  const { corpo, cabeca } = caixasDeAcerto(PES, false);

  // Começa nos pés e termina no topo da cabeça.
  assert.equal(corpo.min.y, PES.y);
  quase(cabeca.max.y, PES.y + FISICA.ALTURA, 'topo da cabeça');

  // O topo do corpo é exatamente a base da cabeça: nem buraco, nem dupla
  // contagem (que faria o mesmo tiro valer headshot e tiro no corpo).
  assert.equal(corpo.max.y, cabeca.min.y);

  // A cabeça tem a altura combinada.
  quase(cabeca.max.y - cabeca.min.y, CORPO.ALTURA_CABECA, 'altura da cabeça');

  // E é mais estreita que o tronco.
  assert.ok(cabeca.max.x - cabeca.min.x < corpo.max.x - corpo.min.x);
});

test('agachado: a cabeça DESCE junto, em vez de ficar boiando no ar', () => {
  const emPe = caixasDeAcerto(PES, false);
  const agachado = caixasDeAcerto(PES, true);

  assert.ok(agachado.cabeca.max.y < emPe.cabeca.min.y + 0.01, 'a cabeça agachada precisa estar bem mais baixa');
  quase(agachado.cabeca.max.y, PES.y + FISICA.ALTURA_AGACHADO, 'topo agachado');
  assert.equal(agachado.corpo.max.y, agachado.cabeca.min.y);
  // Os pés não mudam de lugar ao agachar.
  assert.equal(agachado.corpo.min.y, PES.y);
  // E a cabeça continua sendo uma cabeça, não uma fatia fina.
  quase(agachado.cabeca.max.y - agachado.cabeca.min.y, CORPO.ALTURA_CABECA, 'cabeça agachada');
});

test('os olhos ficam dentro da cabeça, em pé e agachado', () => {
  for (const agachado of [false, true]) {
    const { cabeca } = caixasDeAcerto(PES, agachado);
    const olhos = PES.y + alturaDosOlhos(agachado);
    assert.ok(
      olhos >= cabeca.min.y && olhos <= cabeca.max.y,
      `olhos em ${olhos} fora da cabeça (${cabeca.min.y}..${cabeca.max.y}), agachado=${agachado}`
    );
  }
});

test('as caixas acompanham a posição do jogador', () => {
  const a = caixasDeAcerto({ x: 0, y: 0, z: 0 }, false);
  const b = caixasDeAcerto({ x: 3, y: 2, z: -5 }, false);
  assert.equal(b.cabeca.min.x - a.cabeca.min.x, 3);
  assert.equal(b.cabeca.min.y - a.cabeca.min.y, 2);
  assert.equal(b.cabeca.min.z - a.cabeca.min.z, -5);
});

test('alturaDoCorpo devolve as duas alturas conhecidas', () => {
  assert.equal(alturaDoCorpo(false), FISICA.ALTURA);
  assert.equal(alturaDoCorpo(true), FISICA.ALTURA_AGACHADO);
  assert.ok(FISICA.ALTURA_AGACHADO < FISICA.ALTURA);
  // Agachado ainda precisa caber em pé numa passagem de 2 blocos.
  assert.ok(FISICA.ALTURA <= 2);
});

test('o boneco desenhado cabe na altura que as caixas declaram', () => {
  // O cliente monta o boneco a partir destas mesmas constantes; aqui só
  // conferimos que as peças somam a altura total e a cabeça fica no topo.
  const alturaTronco = FISICA.ALTURA - CORPO.ALTURA_CABECA - CORPO.QUADRIL;
  assert.ok(alturaTronco > 0.3, 'o tronco não pode ficar achatado');
  // Soma de frações binárias não fecha exata (0.85+0.55+0.4 = 1.7999…).
  assert.ok(Math.abs(CORPO.QUADRIL + alturaTronco + CORPO.ALTURA_CABECA - FISICA.ALTURA) < 1e-9);
  assert.ok(CORPO.QUADRIL_AGACHADO < CORPO.QUADRIL);
});

test('inclinar leva as caixas de acerto junto — espiar expõe o corpo', () => {
  const reto = caixasDeAcerto(PES, false, 0, 0);
  // yaw 0 olha para -Z, então a direita é +X.
  const direita = caixasDeAcerto(PES, false, 1, 0);
  const esquerda = caixasDeAcerto(PES, false, -1, 0);

  assert.ok(direita.cabeca.min.x > reto.cabeca.min.x, 'inclinar à direita move a cabeça para +X');
  assert.ok(esquerda.cabeca.min.x < reto.cabeca.min.x, 'inclinar à esquerda move para -X');

  // A cabeça sai mais que o tronco, como um corpo que tomba.
  const desvioCabeca = direita.cabeca.min.x - reto.cabeca.min.x;
  const desvioCorpo = direita.corpo.min.x - reto.corpo.min.x;
  assert.ok(desvioCabeca > desvioCorpo, 'a cabeça precisa sair mais que o tronco');
  assert.ok(desvioCorpo > 0, 'o tronco também acompanha um pouco');

  // A altura não muda ao inclinar: só o lado.
  quase(direita.cabeca.max.y, reto.cabeca.max.y, 'altura ao inclinar');
  assert.equal(direita.corpo.min.y, reto.corpo.min.y);
});

test('a inclinação segue o yaw: virado 90°, o desvio vai para outro eixo', () => {
  const olhandoParaMenosZ = caixasDeAcerto(PES, false, 1, 0);
  const olhandoParaMenosX = caixasDeAcerto(PES, false, 1, Math.PI / 2);

  // Olhando para -Z, a direita é +X; girado 90°, a direita passa a ser -Z.
  assert.ok(olhandoParaMenosZ.cabeca.min.x > PES.x - CORPO.LARGURA_CABECA);
  quase(olhandoParaMenosX.cabeca.min.x, PES.x - CORPO.LARGURA_CABECA / 2, 'sem desvio em X');
  assert.ok(olhandoParaMenosX.cabeca.min.z < PES.z, 'o desvio foi para -Z');
});
