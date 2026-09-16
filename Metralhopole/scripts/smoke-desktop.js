import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir, mkdtemp} from 'node:fs/promises';
import path from 'node:path';

await mkdir('.cache', {recursive:true});
await mkdir('test-results', {recursive:true});
const profile = await mkdtemp(path.resolve('.cache/desktop-test-'));
const env = {...process.env, METRALHOPOLE_USER_DATA:profile, METRALHOPOLE_SMOKE:'1'};
delete env.ELECTRON_RUN_AS_NODE;
const args = process.env.METRALHOPOLE_TEST_EXE ? {executablePath:process.env.METRALHOPOLE_TEST_EXE, args:[]} : {args:['.']};
const application = await electron.launch({...args, env});
const errors = [];
try {
  const page = await application.firstWindow();
  page.on('pageerror', error => errors.push(error.message));
  await page.locator('#host').waitFor();
  // O Chromium empacotado pode não disponibilizar uma superfície de captura
  // para janelas ocultas. Capturas visuais são feitas no teste de desenvolvimento.
  if (!process.env.METRALHOPOLE_TEST_EXE) await page.screenshot({path:'test-results/desktop-menu.png'});
  await page.locator('#name').fill('Guilherme');
  await page.locator('#host').click();
  await page.waitForFunction(() => /^[A-Z0-9]{6}$/.test(document.getElementById('room-code').textContent));
  const code = await page.locator('#room-code').textContent();
  for (let i = 1; i < 8; i++) {
    const response = await fetch('http://127.0.0.1:3000/api/join', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({code,name:`Amigo ${i}`})});
    assert.equal(response.status, 200);
  }
  await page.waitForFunction(() => document.querySelectorAll('.player').length === 8);
  await page.locator('#start').click();
  await page.locator('[data-action="roll"]').click();
  await page.locator('[data-action="end"]').waitFor();
  assert.equal(await page.locator('.tile').count(), 60);
  assert.equal(await page.locator('.token').count(), 8);
  if (!process.env.METRALHOPOLE_TEST_EXE) await page.screenshot({path:'test-results/desktop-game.png'});
  await page.locator('[data-action="end"]').click();
  await page.waitForFunction(() => document.querySelector('[data-action="roll"]') || document.getElementById('turn-title').textContent === 'Amigo 1');
  for (let attempt = 0; attempt < 2 && await page.locator('[data-action="roll"]').count(); attempt++) {
    await page.locator('[data-action="roll"]').click();
    await page.locator('[data-action="end"]').click();
    await page.waitForFunction(() => document.querySelector('[data-action="roll"]') || document.getElementById('turn-title').textContent === 'Amigo 1');
  }
  await page.waitForFunction(() => document.getElementById('turn-title').textContent === 'Amigo 1');
  await page.locator('#rules-button').click();
  assert.equal(await page.locator('#rules').isVisible(), true);
  await page.locator('#close-rules').click();
  await page.locator('#view').click();
  assert.equal(await page.locator('.board.top').count(), 1);
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('.player').length === 8);
  await page.locator('#leave').click();
  await page.locator('#confirm-leave').click();
  await page.locator('#host').waitFor();
  assert.deepEqual(errors, []);
  console.log('Desktop validado: janela, hospedagem, oito jogadores, turno, regras, câmera, reconexão e saída.');
} finally {
  await application.evaluate(({app}) => app.exit(0)).catch(() => {});
}
