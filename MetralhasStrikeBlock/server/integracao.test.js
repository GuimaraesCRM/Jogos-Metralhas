/**
 * Integração em duas camadas:
 *
 *  1. O motor da partida em processo, com relógio sintético — dá para
 *     atravessar freeze time e round inteiro sem esperar um segundo real.
 *  2. O servidor de verdade, por WebSocket — prova que criar sala, escolher
 *     time, iniciar partida e a validação anti-teleporte funcionam de ponta a
 *     ponta no fio.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

import { Partida } from './partida.js';
import { DO_CLIENTE, DO_SERVIDOR } from '../shared/protocolo.js';
import { ECONOMIA, FASES, TIMES } from '../shared/constantes.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// ------------------------------------------------------- camada 1: motor

const T0 = 10_000_000;

function salaFalsa() {
  const jogadores = new Map();
  jogadores.set('ana', { id: 'ana', nome: 'Ana', time: TIMES.AZUL, conectado: true, ws: null });
  jogadores.set('vera', { id: 'vera', nome: 'Vera', time: TIMES.VERMELHO, conectado: true, ws: null });
  return { jogadores };
}

function eventosDoTipo(eventos, tipo) {
  return eventos.filter((e) => e.tipo === tipo);
}

test('motor: compra no freeze, recusa fora dele, e bloco colocado na base', () => {
  const partida = new Partida({ sala: salaFalsa(), agora: T0 });
  partida.drenarEventos(); // descarta os corrigir_pos dos spawns

  // Comprar blocos durante o freeze, dentro da base: ok.
  partida.tratarComprar('ana', 'blocos');
  let eventos = partida.drenarEventos();
  assert.equal(eventosDoTipo(eventos, DO_SERVIDOR.COMPRA_OK).length, 1);
  assert.equal(partida.jogador('ana').blocos, 6);
  assert.equal(partida.jogador('ana').dinheiro, ECONOMIA.INICIAL - 200);

  // Colocar um bloco no chão da base, ao alcance.
  const pos = partida.corpos.get('ana').pos;
  const alvo = { x: Math.floor(pos.x) + 2, y: 1, z: Math.floor(pos.z) };
  partida.tratarColocarBloco('ana', alvo, T0 + 1000);
  eventos = partida.drenarEventos();
  const mudancas = eventosDoTipo(eventos, DO_SERVIDOR.BLOCO_MUDOU);
  assert.equal(mudancas.length, 1, 'o bloco deveria ter sido colocado');
  assert.equal(partida.jogador('ana').blocos, 5);

  // Freeze acaba; a loja fecha.
  partida.tickPartida(T0 + 16_000, 33);
  assert.equal(partida.estado.fase, FASES.COMBATE);
  partida.tratarComprar('ana', 'mc47');
  eventos = partida.drenarEventos();
  assert.equal(eventosDoTipo(eventos, DO_SERVIDOR.COMPRA_FALHOU).length, 1);
});

test('motor: teleporte é rejeitado com corrigir_pos', () => {
  const partida = new Partida({ sala: salaFalsa(), agora: T0 });
  partida.drenarEventos();

  const corpo = partida.corpos.get('ana');
  const posOriginal = { ...corpo.pos };

  partida.tratarEstadoJogador(
    'ana',
    { pos: { x: corpo.pos.x + 30, y: corpo.pos.y, z: corpo.pos.z }, yaw: 0, pitch: 0 },
    T0 + 100
  );

  const correcoes = eventosDoTipo(partida.drenarEventos(), DO_SERVIDOR.CORRIGIR_POS);
  assert.equal(correcoes.length, 1);
  assert.deepEqual(corpo.pos, posOriginal, 'a posição do servidor não pode ter mudado');
});

test('motor: tiro mata, paga e fecha o round por eliminação', () => {
  const partida = new Partida({ sala: salaFalsa(), agora: T0 });
  partida.drenarEventos();

  // Campo aberto no meio do mapa (sem paredes entre os dois).
  partida.corpos.get('ana').pos = { x: 25.5, y: 1, z: 42.5 };
  partida.corpos.get('vera').pos = { x: 35.5, y: 1, z: 42.5 };

  partida.tickPartida(T0 + 16_000, 33); // fim do freeze
  assert.equal(partida.estado.fase, FASES.COMBATE);
  partida.drenarEventos();

  // Ana atira com a pistola no tronco da Vera: 26 de dano por tiro, 4 tiros.
  const olhos = { x: 25.5, y: 1 + 1.62, z: 42.5 };
  const peito = { x: 35.5, y: 1 + 1.0, z: 42.5 };
  const direcao = { x: peito.x - olhos.x, y: peito.y - olhos.y, z: peito.z - olhos.z };

  let agora = T0 + 17_000;
  for (let i = 0; i < 4; i++) {
    partida.tratarAtirar('ana', { origem: olhos, direcao }, agora);
    agora += 200; // respeita a cadência da PM-9
  }

  const eventos = partida.drenarEventos();
  const danos = eventosDoTipo(eventos, DO_SERVIDOR.DANO);
  assert.equal(danos.length, 4, `esperava 4 tiros acertando, veio ${danos.length}`);
  const mortes = eventosDoTipo(eventos, DO_SERVIDOR.MORTE);
  assert.equal(mortes.length, 1);
  assert.equal(mortes[0].dados.vitima, 'vera');
  assert.equal(partida.jogador('vera').vivo, false);

  // O tick seguinte fecha o round: eliminação, vitória azul, economia paga.
  partida.tickPartida(agora, 33);
  const fims = eventosDoTipo(partida.drenarEventos(), DO_SERVIDOR.FIM_ROUND);
  assert.equal(fims.length, 1);
  assert.equal(fims[0].dados.vencedor, TIMES.AZUL);
  assert.equal(partida.estado.placar[TIMES.AZUL], 1);
  // 800 iniciais + 300 do kill + 3000 da vitória.
  assert.equal(partida.jogador('ana').dinheiro, 800 + 300 + 3000);

  // Pós-round passa e o round 2 começa com todo mundo vivo.
  partida.tickPartida(agora + 6000, 33);
  assert.equal(partida.estado.fase, FASES.COMPRA);
  assert.equal(partida.estado.round, 2);
  assert.equal(partida.jogador('vera').vivo, true);
});

test('motor: parede segura o tiro — ninguém morre através de muro', () => {
  const partida = new Partida({ sala: salaFalsa(), agora: T0 });
  partida.drenarEventos();

  // Vera atrás da parede quebra-visão x=22 (z 20..30): Ana do outro lado.
  partida.corpos.get('ana').pos = { x: 18.5, y: 1, z: 25.5 };
  partida.corpos.get('vera').pos = { x: 25.5, y: 1, z: 25.5 };

  partida.tickPartida(T0 + 16_000, 33);
  partida.drenarEventos();

  const olhos = { x: 18.5, y: 2.62, z: 25.5 };
  const direcao = { x: 1, y: -0.06, z: 0 };
  partida.tratarAtirar('ana', { origem: olhos, direcao }, T0 + 17_000);

  const eventos = partida.drenarEventos();
  assert.equal(eventosDoTipo(eventos, DO_SERVIDOR.DANO).length, 0, 'tiro não atravessa muro');
  assert.equal(partida.jogador('vera').hp, 100);
});

// --------------------------------------------------- camada 2: WebSocket

const PORTA_TESTE = 8899;

function conectar() {
  return new Promise((resolver, falhar) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORTA_TESTE}`);
    ws.mensagens = [];
    ws.on('message', (bruto) => ws.mensagens.push(JSON.parse(bruto.toString())));
    ws.on('open', () => resolver(ws));
    ws.on('error', falhar);
  });
}

function mandar(ws, tipo, dados = {}) {
  ws.send(JSON.stringify({ tipo, ...dados }));
}

/** Espera chegar uma mensagem do tipo pedido (consome da fila). */
async function esperar(ws, tipo, timeoutMs = 4000) {
  const inicio = Date.now();
  for (;;) {
    const indice = ws.mensagens.findIndex((m) => m.tipo === tipo);
    if (indice >= 0) return ws.mensagens.splice(indice, 1)[0];
    if (Date.now() - inicio > timeoutMs) {
      throw new Error(`timeout esperando '${tipo}' (fila: ${ws.mensagens.map((m) => m.tipo).join(', ')})`);
    }
    await new Promise((r) => setTimeout(r, 20));
  }
}

test('servidor real: sala, times, partida e anti-teleporte pelo fio', async (t) => {
  const servidor = spawn(process.execPath, ['server/index.js'], {
    cwd: RAIZ,
    env: { ...process.env, PORT: String(PORTA_TESTE) },
    stdio: ['ignore', 'pipe', 'inherit']
  });
  t.after(() => servidor.kill());

  // Espera o servidor abrir a porta.
  await new Promise((resolver, falhar) => {
    const inicio = Date.now();
    const tentar = () => {
      const ws = new WebSocket(`ws://127.0.0.1:${PORTA_TESTE}`);
      ws.on('open', () => {
        ws.close();
        resolver();
      });
      ws.on('error', () => {
        if (Date.now() - inicio > 8000) falhar(new Error('servidor não subiu'));
        else setTimeout(tentar, 150);
      });
    };
    tentar();
  });

  const ana = await conectar();
  const vera = await conectar();
  t.after(() => {
    ana.close();
    vera.close();
  });

  // Ana cria a sala, Vera entra.
  mandar(ana, DO_CLIENTE.CRIAR_SALA, { nome: 'Ana' });
  const entrouAna = await esperar(ana, DO_SERVIDOR.ENTROU);
  assert.match(entrouAna.codigo, /^[A-Z]{4}$/);

  mandar(vera, DO_CLIENTE.ENTRAR_SALA, { codigo: entrouAna.codigo, nome: 'Vera' });
  const entrouVera = await esperar(vera, DO_SERVIDOR.ENTROU);
  assert.equal(entrouVera.codigo, entrouAna.codigo);

  // Times e início (só o anfitrião consegue iniciar).
  mandar(ana, DO_CLIENTE.ESCOLHER_TIME, { time: TIMES.AZUL });
  mandar(vera, DO_CLIENTE.ESCOLHER_TIME, { time: TIMES.VERMELHO });

  mandar(vera, DO_CLIENTE.INICIAR_PARTIDA);
  const recusa = await esperar(vera, DO_SERVIDOR.ERRO);
  assert.match(recusa.mensagem, /anfitri/i);

  mandar(ana, DO_CLIENTE.INICIAR_PARTIDA);
  await esperar(ana, DO_SERVIDOR.PARTIDA_INICIADA);
  await esperar(vera, DO_SERVIDOR.PARTIDA_INICIADA);

  // Spawn chega por corrigir_pos e as fotos do estado começam a pingar.
  const spawnAna = await esperar(ana, DO_SERVIDOR.CORRIGIR_POS);
  const foto = await esperar(ana, DO_SERVIDOR.SNAPSHOT);
  assert.equal(foto.fase, FASES.COMPRA);
  assert.equal(foto.jogadores.length, 2);
  assert.equal(foto.eu.dinheiro, ECONOMIA.INICIAL);

  // Movimento honesto (passinho) não gera correção; teleporte gera.
  const pos = spawnAna.pos;
  mandar(ana, DO_CLIENTE.ESTADO_JOGADOR, {
    pos: { x: pos.x + 0.1, y: pos.y, z: pos.z },
    yaw: 0,
    pitch: 0,
    agachado: false
  });
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(
    ana.mensagens.some((m) => m.tipo === DO_SERVIDOR.CORRIGIR_POS),
    false,
    'movimento legítimo não deveria ser corrigido'
  );

  mandar(ana, DO_CLIENTE.ESTADO_JOGADOR, {
    pos: { x: pos.x + 25, y: pos.y, z: pos.z },
    yaw: 0,
    pitch: 0,
    agachado: false
  });
  const correcao = await esperar(ana, DO_SERVIDOR.CORRIGIR_POS);
  assert.ok(Math.abs(correcao.pos.x - (pos.x + 0.1)) < 0.001, 'volta para a última posição aceita');

  // Compra pelo fio, dentro do freeze.
  mandar(ana, DO_CLIENTE.COMPRAR, { itemId: 'magnum' });
  await esperar(ana, DO_SERVIDOR.COMPRA_OK);
});
