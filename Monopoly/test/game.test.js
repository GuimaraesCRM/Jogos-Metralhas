import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoom, join, act, snapshot, tick, board} from '../game.js';

function game(count = 2) {
  const room = createRoom('ABC123', 'Guilherme');
  for (let i = 1; i < count; i++) join(room, `Amigo ${i}`);
  act(room, room.players[0].token, 'start');
  return room;
}
test('sala aceita oito jogadores, rejeita nono e não expõe tokens', () => {
  const r = createRoom('ABC123', 'Guilherme');
  for (let i = 1; i < 8; i++) join(r, `Amigo ${i}`);
  assert.throws(() => join(r, 'Nono'), /cheia/);
  assert.equal(snapshot(r).players.length, 8);
  for (const p of r.players) assert.equal(JSON.stringify(snapshot(r)).includes(p.token), false);
  assert.throws(() => act(r, r.players[1].token, 'start'), /anfitrião/);
});
test('só começa com dois, impede entrada tardia, ações fora de turno e dados repetidos', () => {
  const r = createRoom('ABC123', 'A');
  assert.throws(() => act(r, r.players[0].token, 'start'), /pelo menos/);
  join(r, 'B'); act(r, r.players[0].token, 'start');
  assert.throws(() => join(r, 'C'), /começou/);
  assert.throws(() => act(r, 'forjado', 'roll'), /inválida/);
  assert.throws(() => act(r, r.players[1].token, 'roll'), /turno/);
  assert.throws(() => act(r, r.players[0].token, 'end'), /primeiro/);
  act(r, r.players[0].token, 'roll', null, () => 1);
  assert.throws(() => act(r, r.players[0].token, 'roll'), /já foram/);
});
test('compra, melhoria e aluguel alteram apenas os saldos corretos', () => {
  const r = game(); const [a,b] = r.players; const tile = board[2];
  act(r, a.token, 'roll', null, () => 1);
  act(r, a.token, 'buy');
  assert.equal(a.money, 1500 - tile.price);
  assert.throws(() => act(r, a.token, 'buy'), /disponível/);
  act(r, a.token, 'upgrade', 2);
  assert.equal(r.properties[2].level, 1);
  const balance = a.money;
  act(r, a.token, 'end'); act(r, b.token, 'roll', null, () => 1);
  assert.equal(b.money, 1500 - tile.rent * 2);
  assert.equal(a.money, balance + tile.rent * 2);
  assert.throws(() => act(r, b.token, 'upgrade', 2), /indisponível/);
});
test('limites de dinheiro, nível e bônus ao passar pela partida', () => {
  const r = game(); const p = r.players[0]; p.position = 23;
  act(r, p.token, 'roll', null, () => 1);
  assert.equal(p.position, 1); assert.equal(p.money, 1700);
  p.money = 0; assert.throws(() => act(r, p.token, 'buy'), /Saldo/);
  p.money = 2000; act(r, p.token, 'buy');
  for (let i = 0; i < 3; i++) act(r, p.token, 'upgrade', 1);
  assert.throws(() => act(r, p.token, 'upgrade', 1), /indisponível/);
});
test('falência liquida propriedades e encerra com último sobrevivente', () => {
  const r = game(); const [a,b] = r.players;
  r.properties[1] = {owner:a.id, level:2};
  r.properties[2] = {owner:b.id, level:3};
  a.money = 1;
  act(r, a.token, 'roll', null, () => 1);
  assert.equal(a.bankrupt, true); assert.equal(r.properties[1], undefined);
  assert.equal(b.money, 1501); assert.equal(r.phase, 'finished'); assert.deepEqual(r.winner, [b.id]);
});
test('timeout passa turno e desistência preserva o andamento', () => {
  const r = game(3); r.deadline = Date.now() - 1; tick(r);
  assert.equal(r.turn, 1);
  act(r, r.players[1].token, 'leave'); assert.equal(r.turn, 2);
  act(r, r.players[0].token, 'leave'); assert.equal(r.phase, 'finished');
  assert.deepEqual(r.winner, [r.players[2].id]);
});
test('partida completa com oito jogadores termina em vinte rodadas', () => {
  const r = game(8);
  for (let i = 0; i < 160; i++) {
    const p = r.players[r.turn];
    act(r, p.token, 'roll', null, () => 1);
    act(r, p.token, 'end');
  }
  assert.equal(r.phase, 'finished'); assert.equal(r.winner.length, 8);
});
