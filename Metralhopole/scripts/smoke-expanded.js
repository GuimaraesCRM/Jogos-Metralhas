import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir, mkdtemp} from 'node:fs/promises';
import path from 'node:path';
import {createServer} from '../server.js';
import {createRoom, join, act, INDUSTRIES, JAIL} from '../game.js';

const room = createRoom('CITY01','Ana'); join(room,'Bruno'); act(room,room.players[0].token,'start');
const [ana,bruno] = room.players;
Object.assign(ana,{money:432100,position:JAIL,jailed:true,jailTurns:1,jailCards:1});
room.properties[1] = {owner:ana.id,level:2};
for (const id of INDUSTRIES.slice(0,3)) room.properties[id] = {owner:ana.id,level:0};
room.properties[INDUSTRIES[3]] = {owner:bruno.id,level:0};
const server = createServer({rooms:new Map([[room.code,room]])});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const port = server.address().port, endpoint = `http://127.0.0.1:${port}`;
await mkdir('.cache',{recursive:true});
const profile = await mkdtemp(path.resolve('.cache/expanded-test-'));
const env = {...process.env,METRALHOPOLE_USER_DATA:profile,METRALHOPOLE_SMOKE:'1'};
delete env.ELECTRON_RUN_AS_NODE;
let application;
const errors=[];
async function launch() {
  const args = process.env.METRALHOPOLE_TEST_EXE ? {executablePath:process.env.METRALHOPOLE_TEST_EXE,args:[]} : {args:['.']};
  application = await electron.launch({...args,env});
  const page = await application.firstWindow(); page.on('pageerror',e=>errors.push(e.message)); return page;
}
async function closeApp() { await application.evaluate(({app})=>app.exit(0)).catch(()=>{}); }
try {
  let page=await launch(); await page.locator('#host').waitFor();
  await page.evaluate(session=>localStorage.setItem('session',JSON.stringify(session)),{endpoint,code:room.code,id:ana.id,token:ana.token});
  await page.reload(); await page.locator('[data-action="jail-card"]').waitFor();
  assert.equal(await page.locator('.tile').count(),60);
  assert.equal(await page.locator('.tile.industry').count(),4);
  await page.locator('#pause').click(); await page.locator('#pause-banner').waitFor();
  const saved=JSON.stringify({players:room.players,properties:room.properties,turn:room.turn,remaining:room.pauseRemaining});
  server.closeAllConnections(); await new Promise(resolve=>server.close(resolve));
  await page.waitForFunction(()=>document.getElementById('connection').textContent.includes('SEM CONEXÃO'));
  assert.equal(await page.locator('[data-action="roll"]').count(),0);
  await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
  await page.locator('#reconnect').click();
  await page.waitForFunction(()=>document.getElementById('connection').textContent.includes('● CONECTADO'));
  assert.equal(JSON.stringify({players:room.players,properties:room.properties,turn:room.turn,remaining:room.pauseRemaining}),saved);
  await closeApp(); page=await launch();
  await page.locator('#pause-banner').waitFor();
  assert.equal(JSON.stringify({players:room.players,properties:room.properties,turn:room.turn,remaining:room.pauseRemaining}),saved);
  await page.locator('#pause').click(); await page.locator('[data-action="jail-card"]').click();
  await page.waitForFunction(()=>!document.querySelector('[data-action="jail-card"]'));
  assert.equal(ana.jailed,false); assert.equal(ana.jailCards,0);
  await page.locator('[data-tile="52"]').click();
  await page.locator('#tile-dialog').waitFor();
  assert.match(await page.locator('#tile-detail').textContent(),/25.000/);
  await page.locator('#close-tile').click();
  await page.locator('[data-open-trade]').click();
  await page.locator('#trade-type').selectOption('buy');
  await page.locator('#trade-property').selectOption('52');
  await page.locator('#trade-price').fill('70000');
  await page.locator('#send-trade').click();
  await page.locator('[data-action="trade-cancel"]').waitFor();
  const response=await fetch(endpoint+'/api/action',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${bruno.token}`},body:JSON.stringify({code:room.code,action:'trade-accept',value:room.trade.id})});
  assert.equal(response.status,200);
  await page.waitForFunction(()=>document.getElementById('turn-description').textContent.includes('venceu com as quatro indústrias'));
  assert.deepEqual(room.winner,[ana.id]); assert.equal(ana.money,362100);
  assert.deepEqual(errors,[]);
  console.log('Metralhopole validado: prisão, carta, 60 casas, indústria, vitória, pausa, queda de conexão e reabertura com progresso intacto.');
} finally {
  if(application) await closeApp(); server.closeAllConnections(); await new Promise(resolve=>server.close(resolve));
}
