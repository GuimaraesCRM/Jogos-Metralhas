import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoom, join, act, tick} from '../game.js';

function setup() {
  const r = createRoom('ABC123', 'Ana'); join(r, 'Bruno'); join(r, 'Carla');
  act(r, r.players[0].token, 'start');
  for (const p of r.players) p.money = 1500;
  r.properties[1] = {owner:r.players[0].id, level:2};
  r.properties[2] = {owner:r.players[1].id, level:1};
  return r;
}
function offer(r, type = 'buy', price = 250) {
  act(r, r.players[0].token, 'trade-offer', {type, target:r.players[1].id, property:type === 'buy' ? 2 : 1, price});
  return r.trade.id;
}
test('oferta de compra só transfere após aceitação do dono fora de seu turno', () => {
  const r = setup(); const [a,b,c] = r.players;
  const id = offer(r);
  assert.equal(r.properties[2].owner, b.id); assert.equal(a.money, 1500);
  assert.throws(() => act(r, a.token, 'trade-accept', id), /destinatário/);
  assert.throws(() => act(r, c.token, 'trade-accept', id), /destinatário/);
  act(r, b.token, 'trade-accept', id);
  assert.equal(a.money, 1250); assert.equal(b.money, 1750);
  assert.deepEqual(r.properties[2], {owner:a.id, level:1});
  assert.equal(r.trade, null); assert.equal(r.turn, 0); assert.equal(r.stage, 'roll');
  assert.throws(() => act(r, b.token, 'trade-accept', id), /disponível/);
  assert.equal(a.money + b.money, 3000);
});
test('oferta de venda preserva melhorias e usa o preço escolhido, não o preço do banco', () => {
  const r = setup(); const [a,b] = r.players;
  const id = offer(r, 'sell', 401); act(r, b.token, 'trade-accept', id);
  assert.equal(a.money, 1901); assert.equal(b.money, 1099);
  assert.deepEqual(r.properties[1], {owner:b.id, level:2});
});
test('recusa e cancelamento não transferem patrimônio e permitem nova proposta', () => {
  const r = setup(); const [a,b] = r.players;
  const original = JSON.stringify({players:r.players, properties:r.properties});
  let id = offer(r); act(r, b.token, 'trade-reject', id);
  id = offer(r, 'sell');
  assert.throws(() => act(r, b.token, 'trade-cancel', id), /autor/);
  act(r, a.token, 'trade-cancel', id);
  assert.equal(JSON.stringify({players:r.players, properties:r.properties}), original);
});
test('valida vez, destinatário, propriedade, preço, saldo e oferta única', () => {
  const r = setup(); const [a,b] = r.players;
  const good = {type:'buy', target:b.id, property:2, price:250};
  assert.throws(() => act(r, b.token, 'trade-offer', good), /turno/);
  for (const price of [0,-10,1.5,Infinity,NaN,'250',Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => act(r, a.token, 'trade-offer', {...good, price}), /inteiro positivo/);
  }
  for (const value of [{...good, target:a.id}, {...good, target:'inexistente'}, {...good, property:1}, {...good, property:4}, {...good, property:3}, {...good, property:'2'}, {...good, type:'gift'}]) {
    assert.throws(() => act(r, a.token, 'trade-offer', value));
  }
  assert.throws(() => offer(r, 'buy', 1501), /saldo/);
  offer(r); assert.throws(() => offer(r), /pendente/);
  assert.throws(() => act(r, a.token, 'roll'), /resposta/);
  assert.throws(() => act(r, a.token, 'upgrade', 1), /resposta/);
});
test('revalida saldo e titularidade no aceite sem transferências parciais', () => {
  const r = setup(); const [a,b,c] = r.players;
  let id = offer(r); a.money = 100;
  assert.throws(() => act(r, b.token, 'trade-accept', id), /saldo/);
  assert.equal(b.money, 1500); assert.equal(r.properties[2].owner, b.id);
  a.money = 1500; r.properties[2].owner = c.id;
  assert.throws(() => act(r, b.token, 'trade-accept', id), /condições/);
  assert.equal(r.trade, null); assert.equal(a.money, 1500); assert.equal(b.money, 1500);
});
test('fim de turno, timeout e desistência invalidam ofertas pendentes', () => {
  for (const reason of ['end','timeout','leave']) {
    const r = setup(); const [a,b] = r.players;
    let i = 0; act(r, a.token, 'roll', null, () => [1,2][i++]);
    const id = offer(r);
    if (reason === 'end') act(r, a.token, 'end');
    if (reason === 'timeout') { r.deadline = Date.now() - 1; tick(r); }
    if (reason === 'leave') act(r, b.token, 'leave');
    assert.equal(r.trade, null);
    assert.throws(() => act(r, b.token, 'trade-accept', id), /disponível/);
  }
});
test('aceite vencido é rejeitado mesmo sem polling prévio', () => {
  const r = setup(); const id = offer(r); r.deadline = Date.now() - 1;
  assert.throws(() => act(r, r.players[1].token, 'trade-accept', id), /disponível/);
  assert.equal(r.properties[2].owner, r.players[1].id);
});
