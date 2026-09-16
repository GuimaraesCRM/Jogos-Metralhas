import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ECONOMIA, FASES, PARTIDA, TEMPOS, TIMES } from './constantes.js';
import {
  aplicarDano,
  aplicarRecarga,
  avaliarRound,
  campeao,
  comprar,
  criarPartida,
  encerrarPartida,
  horaDeTrocarLado,
  iniciarCombate,
  iniciarProximoRound,
  registrarKill,
  terminarRound,
  trocarLados,
  vivosDoTime
} from './regras.js';

const T0 = 1_000_000;

function partida2v2() {
  return criarPartida({
    agora: T0,
    jogadores: [
      { id: 'a1', nome: 'Ana', time: TIMES.AZUL },
      { id: 'a2', nome: 'Alan', time: TIMES.AZUL },
      { id: 'v1', nome: 'Vera', time: TIMES.VERMELHO },
      { id: 'v2', nome: 'Vitor', time: TIMES.VERMELHO }
    ]
  });
}

test('partida nasce na fase de compra, com pistola e dinheiro inicial', () => {
  const p = partida2v2();
  assert.equal(p.fase, FASES.COMPRA);
  assert.equal(p.faseTerminaEm, T0 + TEMPOS.COMPRA * 1000);
  const ana = p.jogadores.get('a1');
  assert.equal(ana.dinheiro, ECONOMIA.INICIAL);
  assert.equal(ana.armas[2].id, 'pm9');
  assert.equal(ana.armas[1], null);
  assert.equal(ana.hp, PARTIDA.HP_MAXIMO);
});

test('compra: só na fase de compra, só na base, só com dinheiro', () => {
  const p = partida2v2();

  assert.equal(comprar(p, 'a1', 'mc47', false).ok, false); // fora da base
  assert.equal(comprar(p, 'a1', 'awb', true).ok, false); // caro demais ($4750 > $800)

  const r = comprar(p, 'a1', 'magnum', true); // $700 cabe nos $800
  assert.equal(r.ok, true);
  const ana = p.jogadores.get('a1');
  assert.equal(ana.dinheiro, ECONOMIA.INICIAL - 700);
  assert.equal(ana.armas[2].id, 'magnum');

  iniciarCombate(p, T0 + 15_000);
  assert.equal(comprar(p, 'a1', 'granada', true).ok, false); // loja fechada
});

test('compra de equipamentos respeita limites', () => {
  const p = partida2v2();
  const ana = p.jogadores.get('a1');
  ana.dinheiro = 5000;

  assert.equal(comprar(p, 'a1', 'granada', true).ok, true);
  assert.equal(comprar(p, 'a1', 'granada', true).ok, true);
  assert.equal(comprar(p, 'a1', 'granada', true).ok, false); // máx. 2

  assert.equal(comprar(p, 'a1', 'capacete', true).ok, true);
  assert.equal(ana.colete, PARTIDA.COLETE_MAXIMO);
  assert.equal(ana.capacete, true);

  for (let i = 0; i < 5; i++) assert.equal(comprar(p, 'a1', 'blocos', true).ok, true);
  assert.equal(ana.blocos, 30);
  assert.equal(comprar(p, 'a1', 'blocos', true).ok, false); // máx. 30
});

test('dano mata, kill paga e o round fecha por eliminação', () => {
  const p = partida2v2();
  iniciarCombate(p, T0 + 15_000);

  assert.equal(aplicarDano(p, 'v1', 60).morreu, false);
  assert.equal(aplicarDano(p, 'v1', 60).morreu, true);
  registrarKill(p, 'a1', 'mc47');
  assert.equal(p.jogadores.get('a1').kills, 1);
  assert.equal(p.jogadores.get('a1').dinheiro, ECONOMIA.INICIAL + 300);
  assert.equal(vivosDoTime(p, TIMES.VERMELHO), 1);

  assert.equal(avaliarRound(p, T0 + 20_000), null); // ainda tem gente viva

  aplicarDano(p, 'v2', 200);
  const fim = avaliarRound(p, T0 + 21_000);
  assert.deepEqual(fim, { vencedor: TIMES.AZUL, motivo: 'eliminacao' });

  const resultado = terminarRound(p, fim, T0 + 21_000);
  assert.equal(resultado.placar[TIMES.AZUL], 1);
  assert.equal(p.fase, FASES.POS_ROUND);
  // Economia: azuis ganham bônus de vitória, vermelhos o de derrota.
  assert.equal(p.jogadores.get('a2').dinheiro, ECONOMIA.INICIAL + ECONOMIA.VITORIA);
  assert.equal(p.jogadores.get('v1').dinheiro, ECONOMIA.INICIAL + ECONOMIA.DERROTA);
});

test('tempo esgotado: vence quem tem mais vivos; empate não pontua', () => {
  const p = partida2v2();
  iniciarCombate(p, T0);
  const fimDoCombate = p.faseTerminaEm;

  // 2×2 vivos no estouro do tempo → empate.
  let fim = avaliarRound(p, fimDoCombate + 1);
  assert.deepEqual(fim, { vencedor: null, motivo: 'tempo' });
  terminarRound(p, fim, fimDoCombate + 1);
  assert.equal(p.placar[TIMES.AZUL], 0);
  assert.equal(p.placar[TIMES.VERMELHO], 0);
  // Empate paga derrota para os dois lados.
  assert.equal(p.jogadores.get('a1').dinheiro, ECONOMIA.INICIAL + ECONOMIA.DERROTA);
  assert.equal(p.jogadores.get('v1').dinheiro, ECONOMIA.INICIAL + ECONOMIA.DERROTA);

  // Próximo round: azul derruba um vermelho e o tempo estoura de novo.
  iniciarProximoRound(p, fimDoCombate + 6000);
  iniciarCombate(p, fimDoCombate + 21_000);
  aplicarDano(p, 'v2', 200);
  fim = avaliarRound(p, p.faseTerminaEm + 1);
  assert.deepEqual(fim, { vencedor: TIMES.AZUL, motivo: 'tempo' });
});

test('próximo round: mortos voltam de pistola, vivos mantêm o arsenal municiado', () => {
  const p = partida2v2();
  const ana = p.jogadores.get('a1');
  ana.dinheiro = 5000;
  comprar(p, 'a1', 'mc47', true);
  comprar(p, 'a1', 'capacete', true);
  const vera = p.jogadores.get('v1');
  vera.dinheiro = 5000;
  comprar(p, 'v1', 'awb', true);

  iniciarCombate(p, T0 + 15_000);
  ana.armas[1].municao = 3; // gastou o pente
  aplicarDano(p, 'v1', 200); // Vera morre com a AWB na mão
  aplicarDano(p, 'v2', 200);
  terminarRound(p, avaliarRound(p, T0 + 20_000), T0 + 20_000);
  iniciarProximoRound(p, T0 + 25_000);

  assert.equal(ana.vivo, true);
  assert.equal(ana.armas[1].id, 'mc47');
  assert.equal(ana.armas[1].municao, 30); // pente cheio de novo
  assert.equal(ana.capacete, true); // sobreviveu, mantém

  assert.equal(vera.vivo, true);
  assert.equal(vera.armas[1], null); // morreu, perdeu a AWB
  assert.equal(vera.armas[2].id, 'pm9');
  assert.equal(p.round, 2);
});

test('troca de lado espelha os times e leva o placar junto dos grupos', () => {
  const p = partida2v2();
  p.placar[TIMES.AZUL] = 5;
  p.placar[TIMES.VERMELHO] = 2;
  p.round = 7;

  assert.equal(horaDeTrocarLado(p), true);
  trocarLados(p);

  assert.equal(p.jogadores.get('a1').time, TIMES.VERMELHO);
  assert.equal(p.jogadores.get('v1').time, TIMES.AZUL);
  // O grupo da Ana (5 vitórias) agora é o vermelho.
  assert.equal(p.placar[TIMES.VERMELHO], 5);
  assert.equal(p.placar[TIMES.AZUL], 2);
  // Economia zerada no swap.
  assert.equal(p.jogadores.get('a1').dinheiro, ECONOMIA.INICIAL);
  assert.equal(p.jogadores.get('a1').armas[1], null);
  assert.equal(horaDeTrocarLado(p), false); // só uma vez
});

test('campeão aos 8 rounds e teto de dinheiro', () => {
  const p = partida2v2();
  assert.equal(campeao(p), null);
  p.placar[TIMES.VERMELHO] = PARTIDA.ROUNDS_PARA_VENCER;
  assert.equal(campeao(p), TIMES.VERMELHO);
  encerrarPartida(p, TIMES.VERMELHO);
  assert.equal(p.fase, FASES.FIM);
  assert.equal(p.vencedorPartida, TIMES.VERMELHO);

  const ana = p.jogadores.get('a1');
  ana.dinheiro = ECONOMIA.TETO - 100;
  registrarKill(p, 'a1', 'canocurto'); // pagaria $900
  assert.equal(ana.dinheiro, ECONOMIA.TETO);
});

test('recarga move balas da reserva para o pente', () => {
  const p = partida2v2();
  const ana = p.jogadores.get('a1');
  ana.armas[2].municao = 2;

  assert.equal(aplicarRecarga(ana), true);
  assert.equal(ana.armas[2].municao, 12);
  assert.equal(ana.armas[2].reserva, 26);

  assert.equal(aplicarRecarga(ana), false); // pente já cheio

  ana.armas[2].municao = 0;
  ana.armas[2].reserva = 5;
  aplicarRecarga(ana);
  assert.equal(ana.armas[2].municao, 5); // reserva curta entrega o que tem
  assert.equal(ana.armas[2].reserva, 0);
});
