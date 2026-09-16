import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir, mkdtemp} from 'node:fs/promises';
import path from 'node:path';
import {createServer} from '../server.js';
import {createRoom, join, act} from '../game.js';

// Fixture determinística em servidor de teste: a API pública não permite definir saldos ou terrenos.
const room = createRoom('TRADE1', 'Ana'); join(room, 'Bruno');
act(room, room.players[0].token, 'start');
for (const player of room.players) player.money = 1500;
room.properties[1] = {owner:room.players[0].id, level:2};
room.properties[2] = {owner:room.players[1].id, level:1};
const server = createServer({rooms:new Map([[room.code, room]])});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const endpoint = `http://127.0.0.1:${server.address().port}`;
const apps = [], pages = [], errors = [];
await mkdir('.cache', {recursive:true});
try {
  for (const player of room.players) {
    const profile = await mkdtemp(path.resolve('.cache/trade-test-'));
    const env = {...process.env, METRALHOPOLE_USER_DATA:profile, METRALHOPOLE_SMOKE:'1'};
    delete env.ELECTRON_RUN_AS_NODE;
    const args = process.env.METRALHOPOLE_TEST_EXE ? {executablePath:process.env.METRALHOPOLE_TEST_EXE, args:[]} : {args:['.']};
    const app = await electron.launch({...args, env}); apps.push(app);
    const page = await app.firstWindow(); pages.push(page);
    page.on('pageerror', error => errors.push(error.message));
    await page.locator('#host').waitFor();
    await page.evaluate(session => localStorage.setItem('session', JSON.stringify(session)), {endpoint, code:room.code, id:player.id, token:player.token});
    await page.reload(); await page.locator('#room-panel').waitFor();
  }
  const [ana, bruno] = pages;
  async function propose(type, property, price) {
    await ana.locator('[data-open-trade]').click();
    await ana.locator('#trade-type').selectOption(type);
    await ana.locator('#trade-target').selectOption(room.players[1].id);
    await ana.locator('#trade-property').selectOption(String(property));
    await ana.locator('#trade-price').fill(String(price));
    await ana.locator('#send-trade').click();
    await bruno.locator('[data-action="trade-accept"]').waitFor();
  }
  await propose('buy', 2, 250);
  assert.equal(room.properties[2].owner, room.players[1].id);
  assert.equal(await ana.locator('[data-action="roll"]').isDisabled(), true);
  assert.match(await bruno.locator('#trade-content').textContent(), /recebe o valor e entrega/);
  await bruno.locator('[data-action="trade-accept"]').click();
  await ana.waitForFunction(() => document.getElementById('asset-count').textContent === '2');
  assert.equal(room.players[0].money, 1250); assert.equal(room.players[1].money, 1750);
  assert.equal(room.properties[2].owner, room.players[0].id);
  await propose('sell', 1, 350);
  assert.match(await bruno.locator('#trade-content').textContent(), /você paga e recebe/);
  await bruno.locator('[data-action="trade-reject"]').click();
  await ana.locator('[data-open-trade]').waitFor();
  assert.equal(room.properties[1].owner, room.players[0].id);
  await propose('sell', 1, 350);
  await bruno.locator('[data-action="trade-accept"]').click();
  await ana.waitForFunction(() => document.getElementById('asset-count').textContent === '1');
  assert.deepEqual(room.properties[1], {owner:room.players[1].id, level:2});
  assert.equal(room.players[0].money, 1600); assert.equal(room.players[1].money, 1400);
  await propose('buy', 1, 100);
  await ana.locator('[data-action="trade-cancel"]').click();
  await bruno.waitForFunction(() => !document.querySelector('[data-action="trade-accept"]'));
  assert.equal(room.trade, null);
  assert.equal(await bruno.locator('[data-open-trade]').count(), 0);
  assert.deepEqual(errors, []);
  console.log('Negociação validada em dois aplicativos: comprar, vender, aceitar, recusar, cancelar e sincronizar valores e melhorias.');
} finally {
  for (const app of apps) await app.evaluate(({app}) => app.exit(0)).catch(() => {});
  server.closeAllConnections(); server.close();
}
