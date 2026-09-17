import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARMAS, CATEGORIAS, EQUIPAMENTOS, MARRETA, armaPorId, precoDe, fatorDistancia, danoDoTiro, intervaloEntreTiros, recuoDoTiro } from './armas.js';

test('tabela tem as 11 armas com campos completos', () => {
  assert.equal(Object.keys(ARMAS).length, 11);
  Object.keys(ARMAS).forEach(key => {
    const arma = ARMAS[key];
    assert.equal(arma.id, key);
    assert.ok('id' in arma);
    assert.ok('nome' in arma);
    assert.ok('categoria' in arma);
    assert.ok('preco' in arma);
    assert.ok('dano' in arma);
    assert.ok('multCabeca' in arma);
    assert.ok('rpm' in arma);
    assert.ok('pente' in arma);
    assert.ok('reserva' in arma);
    assert.ok('spreadBase' in arma);
    assert.ok('spreadAndando' in arma);
    assert.ok('danoBloco' in arma);
    assert.ok('recompensa' in arma);
    assert.ok('slot' in arma);
    assert.ok(arma.dano > 0);
    assert.ok(arma.rpm > 0);
    assert.ok(arma.pente > 0);
  });
});

test('valores pontuais da tabela', () => {
  assert.equal(ARMAS.pm9.preco, 0);
  assert.equal(ARMAS.awb.recompensa, 100);
  assert.equal(ARMAS.canocurto.pellets, 8);
  assert.equal(ARMAS.tribloco.rajada, 3);
  assert.equal(ARMAS.mc47.preco, 2700);
  assert.equal(ARMAS.luneta.zoom, 0.35);
  assert.equal(ARMAS.awb.spreadMirando, 0.001);
  assert.equal(ARMAS.mpbloco.automatica, true);
  assert.equal(ARMAS.magnum.automatica, false);
});

test('precoDe acha armas e equipamentos', () => {
  assert.equal(precoDe('mc47'), 2700);
  assert.equal(precoDe('colete'), 650);
  assert.equal(precoDe('capacete'), 1000);
  assert.equal(precoDe('granada'), 300);
  assert.equal(precoDe('inexistente'), null);
  assert.equal(armaPorId('inexistente'), null);
});

test('fatorDistancia só derruba shotgun', () => {
  assert.equal(fatorDistancia(ARMAS.mc47, 50), 1.0);
  assert.equal(fatorDistancia(ARMAS.awb, 60), 1.0);
  assert.equal(fatorDistancia(ARMAS.canocurto, 5), 1.0);
  assert.equal(fatorDistancia(ARMAS.canocurto, 30), 0.25);
  assert.equal(fatorDistancia(ARMAS.canocurto, 40), 0.25);
  const val19 = fatorDistancia(ARMAS.canocurto, 19);
  assert.ok(val19 > 0.25 && val19 < 1.0);
});

test('danoDoTiro faz as contas certas', () => {
  assert.equal(danoDoTiro(ARMAS.mc47, 'cabeca', false, false), 136);
  assert.equal(danoDoTiro(ARMAS.mc47, 'cabeca', true, true), 68);
  assert.equal(danoDoTiro(ARMAS.mc47, 'corpo', true, false), 20);
  assert.equal(danoDoTiro(ARMAS.awb, 'corpo', false, false), 115);
  assert.equal(danoDoTiro(ARMAS.awb, 'corpo', true, false), 69);
  assert.equal(danoDoTiro(ARMAS.canocurto, 'corpo', false, false, 40), 2);
});

test('intervaloEntreTiros converte rpm em ms', () => {
  assert.equal(intervaloEntreTiros(ARMAS.mc47), 100);
  const x = intervaloEntreTiros(ARMAS.awb);
  assert.ok(Math.abs(x - 1463.4) < 0.1);
});

test('toda arma tem os dados de recuo e de mira', () => {
  for (const [id, arma] of Object.entries(ARMAS)) {
    assert.ok(arma.recuoVertical > 0, `${id} sem recuo vertical`);
    assert.ok(arma.recuoHorizontal > 0, `${id} sem recuo horizontal`);
    assert.ok(arma.recuperacao > 0, `${id} sem recuperação`);
    assert.ok(arma.tirosRetos >= 1, `${id} sem tirosRetos`);
    assert.ok(arma.zoomAds > 0 && arma.zoomAds <= 1, `${id} com zoomAds fora de 0..1`);
    // Mirar sempre tem de valer a pena: o cone fecha, nunca abre.
    assert.ok(arma.spreadMirando <= arma.spreadBase, `${id} fica pior mirando`);
  }
});

test('recuo: sobe no primeiro tiro e abre para os lados no meio do spray', () => {
  const semSorte = () => 0.5; // rnd fixo no meio: sem tempero aleatório
  const arma = ARMAS.mc47;

  const primeiro = recuoDoTiro(arma, 0, semSorte);
  assert.ok(primeiro.pitch > 0, 'o primeiro tiro precisa empurrar para cima');
  assert.ok(Math.abs(primeiro.yaw) < 1e-9, 'os primeiros tiros sobem retos');

  // Já dentro do spray, o tiro passa a puxar para o lado.
  const decimo = recuoDoTiro(arma, 10, semSorte);
  assert.ok(Math.abs(decimo.yaw) > Math.abs(primeiro.yaw), 'o spray precisa abrir');
  // E sobe um pouco menos que no começo.
  assert.ok(decimo.pitch < primeiro.pitch);

  // O lado alterna ao longo do spray, senão daria para compensar com um giro só.
  const lados = new Set();
  for (let tiro = 4; tiro < 16; tiro++) {
    lados.add(Math.sign(recuoDoTiro(arma, tiro, semSorte).yaw));
  }
  assert.ok(lados.has(1) && lados.has(-1), 'o spray precisa puxar para os dois lados');
});

test('recuo: arma pesada coice mais que arma leve', () => {
  const rnd = () => 0.5;
  assert.ok(recuoDoTiro(ARMAS.awb, 0, rnd).pitch > recuoDoTiro(ARMAS.mc47, 0, rnd).pitch);
  assert.ok(recuoDoTiro(ARMAS.mc47, 0, rnd).pitch > recuoDoTiro(ARMAS.mb4, 0, rnd).pitch);
  assert.ok(recuoDoTiro(ARMAS.mb4, 0, rnd).pitch > recuoDoTiro(ARMAS.mpbloco, 0, rnd).pitch);
});

test('marreta e equipamentos', () => {
  assert.equal(MARRETA.recompensa, 1500);
  assert.equal(MARRETA.slot, 3);
  // O impacto sai durante o arco da golpada, nunca depois que ele acabou.
  assert.ok(MARRETA.momentoDoImpacto > 0 && MARRETA.momentoDoImpacto < 1);
  assert.ok(MARRETA.duracaoGolpe > 0);
  assert.equal(EQUIPAMENTOS.granada.maximo, 2);
  assert.equal(EQUIPAMENTOS.blocos.quantidade, 10);
  assert.equal(EQUIPAMENTOS.blocos.maximo, 100);
  assert.equal(CATEGORIAS.SNIPER, 'sniper');
});
