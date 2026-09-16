import test from 'node:test';
import assert from 'node:assert/strict';
import { PALAVRAS } from './palavras.js';
import {
  criarPartida,
  darDica,
  revelarCarta,
  encerrarTurno,
  gerarTabuleiro,
  turnoExpirou,
  adversario,
  normalizar,
  DISTRIBUICAO,
  FASE,
  TIPO
} from './regras.js';

/** Gerador pseudoaleatório com semente, para o teste não depender de sorte. */
function rndComSemente(semente) {
  let s = semente >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Monta uma partida com o tabuleiro trocado por um layout conhecido. */
function partidaControlada() {
  const estado = criarPartida({ rnd: rndComSemente(7) });
  estado.vez = 'vermelho';
  estado.timeInicial = 'vermelho';
  estado.cartas = estado.cartas.map((carta, i) => ({
    ...carta,
    revelada: false,
    reveladaPor: null,
    // 0-8 vermelhas, 9-16 azuis, 17-23 neutras, 24 assassino
    tipo:
      i < 9 ? TIPO.VERMELHO : i < 17 ? TIPO.AZUL : i < 24 ? TIPO.NEUTRA : TIPO.ASSASSINO
  }));
  estado.restantes = { vermelho: 9, azul: 8 };
  estado.fase = FASE.DICA;
  estado.dica = null;
  return estado;
}

test('banco de palavras tem volume e formato adequados', () => {
  assert.ok(PALAVRAS.length >= 200, 'esperado ao menos 200 palavras');
  assert.equal(new Set(PALAVRAS).size, PALAVRAS.length, 'não pode haver repetidas');
  for (const p of PALAVRAS) {
    assert.match(p, /^[A-ZÀ-Ü]+$/, `palavra fora do padrão: ${p}`);
  }
});

test('tabuleiro sai com 25 cartas na proporção 9/8/7/1', () => {
  for (let semente = 1; semente <= 40; semente++) {
    const { cartas, timeInicial } = gerarTabuleiro({ rnd: rndComSemente(semente) });
    assert.equal(cartas.length, DISTRIBUICAO.TOTAL);
    assert.equal(new Set(cartas.map((c) => c.palavra)).size, 25, 'palavras repetidas no tabuleiro');

    const conta = (t) => cartas.filter((c) => c.tipo === t).length;
    assert.equal(conta(timeInicial), 9);
    assert.equal(conta(adversario(timeInicial)), 8);
    assert.equal(conta(TIPO.NEUTRA), 7);
    assert.equal(conta(TIPO.ASSASSINO), 1);
    assert.ok(cartas.every((c) => c.revelada === false));
  }
});

test('partida começa na vez do time inicial, esperando a dica', () => {
  const estado = criarPartida({ rnd: rndComSemente(3) });
  assert.equal(estado.vez, estado.timeInicial);
  assert.equal(estado.fase, FASE.DICA);
  assert.equal(estado.vencedor, null);
  assert.equal(estado.restantes[estado.timeInicial], 9);
  assert.equal(estado.restantes[adversario(estado.timeInicial)], 8);
});

test('dica só é aceita do time da vez, em formato válido', () => {
  const estado = partidaControlada();

  assert.equal(darDica(estado, { time: 'azul', palavra: 'FRUTA', numero: 2 }).ok, false);
  assert.equal(darDica(estado, { time: 'vermelho', palavra: '', numero: 2 }).ok, false);
  assert.equal(darDica(estado, { time: 'vermelho', palavra: 'DUAS PALAVRAS', numero: 1 }).ok, false);
  assert.equal(darDica(estado, { time: 'vermelho', palavra: 'FRUTA', numero: 0 }).ok, false);
  assert.equal(darDica(estado, { time: 'vermelho', palavra: 'FRUTA', numero: 10 }).ok, false);

  // Palavra visível no tabuleiro é recusada, inclusive com acento e caixa diferentes.
  const naMesa = estado.cartas[0].palavra;
  assert.equal(
    darDica(estado, { time: 'vermelho', palavra: naMesa.toLowerCase(), numero: 1 }).ok,
    false
  );

  const r = darDica(estado, { time: 'vermelho', palavra: 'fruta', numero: 3 });
  assert.equal(r.ok, true);
  assert.equal(r.estado.fase, FASE.PALPITE);
  assert.equal(r.estado.dica.palavra, 'FRUTA');
  assert.equal(r.estado.dica.palpitesRestantes, 4, 'dica N dá N+1 palpites');
  assert.equal(estado.fase, FASE.DICA, 'o estado original não pode ser mutado');
});

test('duas dicas seguidas no mesmo turno são recusadas', () => {
  const { estado } = darDica(partidaControlada(), { time: 'vermelho', palavra: 'FRUTA', numero: 2 });
  assert.equal(darDica(estado, { time: 'vermelho', palavra: 'OUTRA', numero: 1 }).ok, false);
});

test('acerto no próprio time mantém o turno e consome um palpite', () => {
  const { estado } = darDica(partidaControlada(), { time: 'vermelho', palavra: 'FRUTA', numero: 2 });
  const r = revelarCarta(estado, { time: 'vermelho', indice: 0 });

  assert.equal(r.ok, true);
  assert.equal(r.evento.resultado, 'acerto');
  assert.equal(r.estado.vez, 'vermelho');
  assert.equal(r.estado.fase, FASE.PALPITE);
  assert.equal(r.estado.restantes.vermelho, 8);
  assert.equal(r.estado.dica.palpitesRestantes, 2);
});

test('palpites acabam depois de N+1 acertos e a vez passa', () => {
  let estado = darDica(partidaControlada(), { time: 'vermelho', palavra: 'FRUTA', numero: 2 }).estado;
  for (const indice of [0, 1]) {
    estado = revelarCarta(estado, { time: 'vermelho', indice }).estado;
    assert.equal(estado.vez, 'vermelho');
  }
  const ultimo = revelarCarta(estado, { time: 'vermelho', indice: 2 });
  assert.equal(ultimo.evento.resultado, 'acerto-ultimo');
  assert.equal(ultimo.estado.vez, 'azul');
  assert.equal(ultimo.estado.fase, FASE.DICA);
  assert.equal(ultimo.estado.restantes.vermelho, 6);
});

test('carta neutra encerra o turno', () => {
  const estado = darDica(partidaControlada(), { time: 'vermelho', palavra: 'FRUTA', numero: 3 }).estado;
  const r = revelarCarta(estado, { time: 'vermelho', indice: 17 });
  assert.equal(r.evento.resultado, 'neutra');
  assert.equal(r.estado.vez, 'azul');
  assert.equal(r.estado.restantes.vermelho, 9);
  assert.equal(r.estado.restantes.azul, 8);
});

test('carta do adversário pontua para ele e encerra o turno', () => {
  const estado = darDica(partidaControlada(), { time: 'vermelho', palavra: 'FRUTA', numero: 3 }).estado;
  const r = revelarCarta(estado, { time: 'vermelho', indice: 9 });
  assert.equal(r.evento.resultado, 'adversario');
  assert.equal(r.estado.restantes.azul, 7);
  assert.equal(r.estado.vez, 'azul');
});

test('assassino entrega a vitória ao adversário na hora', () => {
  const estado = darDica(partidaControlada(), { time: 'vermelho', palavra: 'FRUTA', numero: 3 }).estado;
  const r = revelarCarta(estado, { time: 'vermelho', indice: 24 });
  assert.equal(r.estado.fase, FASE.FIM);
  assert.equal(r.estado.vencedor, 'azul');
  assert.equal(r.estado.motivo, 'assassino');
  assert.equal(revelarCarta(r.estado, { time: 'azul', indice: 1 }).ok, false);
});

test('virar a última carta própria vence a partida', () => {
  let estado = partidaControlada();
  // Deixa só uma carta vermelha de pé.
  for (let i = 0; i < 8; i++) {
    estado.cartas[i].revelada = true;
    estado.cartas[i].reveladaPor = 'vermelho';
  }
  estado.restantes.vermelho = 1;

  estado = darDica(estado, { time: 'vermelho', palavra: 'FINAL', numero: 1 }).estado;
  const r = revelarCarta(estado, { time: 'vermelho', indice: 8 });

  assert.equal(r.estado.fase, FASE.FIM);
  assert.equal(r.estado.vencedor, 'vermelho');
  assert.equal(r.estado.motivo, 'cartas');
  assert.equal(r.estado.restantes.vermelho, 0);
});

test('virar a última carta do adversário entrega a vitória a ele', () => {
  let estado = partidaControlada();
  for (let i = 9; i < 16; i++) {
    estado.cartas[i].revelada = true;
    estado.cartas[i].reveladaPor = 'azul';
  }
  estado.restantes.azul = 1;

  estado = darDica(estado, { time: 'vermelho', palavra: 'ARRISCADA', numero: 1 }).estado;
  const r = revelarCarta(estado, { time: 'vermelho', indice: 16 });

  assert.equal(r.estado.vencedor, 'azul');
  assert.equal(r.estado.motivo, 'cartas');
});

test('não dá para virar carta antes da dica, nem virar duas vezes a mesma', () => {
  const inicial = partidaControlada();
  assert.equal(revelarCarta(inicial, { time: 'vermelho', indice: 0 }).ok, false);

  const comDica = darDica(inicial, { time: 'vermelho', palavra: 'FRUTA', numero: 2 }).estado;
  assert.equal(revelarCarta(comDica, { time: 'azul', indice: 0 }).ok, false);
  assert.equal(revelarCarta(comDica, { time: 'vermelho', indice: 99 }).ok, false);

  const depois = revelarCarta(comDica, { time: 'vermelho', indice: 0 }).estado;
  assert.equal(revelarCarta(depois, { time: 'vermelho', indice: 0 }).ok, false);
});

test('encerrar turno passa a vez e só vale durante os palpites', () => {
  const inicial = partidaControlada();
  assert.equal(encerrarTurno(inicial, { time: 'vermelho' }).ok, false);

  const comDica = darDica(inicial, { time: 'vermelho', palavra: 'FRUTA', numero: 2 }).estado;
  assert.equal(encerrarTurno(comDica, { time: 'azul' }).ok, false);

  const r = encerrarTurno(comDica, { time: 'vermelho' });
  assert.equal(r.ok, true);
  assert.equal(r.estado.vez, 'azul');
  assert.equal(r.estado.fase, FASE.DICA);
  assert.equal(r.estado.dica, null);

  // O estouro do relógio passa a vez mesmo sem ser o time pedindo.
  const porTempo = encerrarTurno(comDica, { time: 'azul', motivo: 'tempo' });
  assert.equal(porTempo.ok, true);
  assert.equal(porTempo.estado.vez, 'azul');
});

test('relógio do turno é respeitado quando configurado', () => {
  const semTimer = criarPartida({ rnd: rndComSemente(5), duracaoTurno: 0 });
  assert.equal(semTimer.turnoTerminaEm, null);
  assert.equal(turnoExpirou(semTimer), false);

  const comTimer = criarPartida({ rnd: rndComSemente(5), duracaoTurno: 60 });
  assert.ok(comTimer.turnoTerminaEm > Date.now());
  assert.equal(turnoExpirou(comTimer), false);
  assert.equal(turnoExpirou(comTimer, comTimer.turnoTerminaEm + 1), true);
});

test('normalizar ignora acento e caixa', () => {
  assert.equal(normalizar('coração'), 'CORACAO');
  assert.equal(normalizar('  Ônibus '), 'ONIBUS');
});
