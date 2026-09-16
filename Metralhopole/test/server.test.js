import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../server.js';
import {RULES} from '../game.js';

test('API conecta oito clientes, autentica sessão e sincroniza turnos', async t => {
  const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function call(path, body, token) {
    const response = await fetch(base + path, {method:body ? 'POST' : 'GET', headers:{'Content-Type':'application/json', ...(token ? {Authorization:`Bearer ${token}`} : {})}, body:body ? JSON.stringify(body) : undefined});
    return {status:response.status, body:await response.json()};
  }
  const created = await call('/api/create', {name:'Host'}); assert.equal(created.status, 201);
  const host = created.body, players = [host];
  for (let i = 1; i < 8; i++) { const res = await call('/api/join', {name:`Amigo ${i}`, code:host.code}); assert.equal(res.status, 200); players.push(res.body); }
  assert.equal((await call('/api/join', {name:'Nono', code:host.code})).status, 400);
  assert.equal((await call(`/api/state?code=${host.code}`)).status, 403);
  assert.equal((await call('/api/action', {code:host.code, action:'start'}, host.token)).status, 200);
  assert.equal((await call('/api/action', {code:host.code, action:'roll'}, players[1].token)).status, 400);
  const roll = await call('/api/action', {code:host.code, action:'roll', dice:[6,6], money:999999}, host.token);
  assert.equal(roll.status, 200); assert.ok(roll.body.players[0].money <= RULES.startingMoney + RULES.chanceBonus);
  const copy = await call(`/api/state?code=${host.code}`, undefined, players[7].token);
  assert.deepEqual(copy.body.dice, roll.body.dice);
  assert.equal(copy.body.players[0].position, roll.body.players[0].position);
  assert.ok(copy.body.players.every(p => !('token' in p)));
  await call('/api/action', {code:host.code, action:'end'}, host.token);
  assert.equal((await call(`/api/state?code=${host.code}`, undefined, host.token)).body.turn, roll.body.extraRoll ? 0 : 1);
});
