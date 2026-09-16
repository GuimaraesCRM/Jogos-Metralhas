import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';
import { createServer } from './server.js';

let server;
let win;
if (process.env.METRALHOPOLE_USER_DATA) app.setPath('userData', process.env.METRALHOPOLE_USER_DATA);
const page = new URL('./public/index.html', import.meta.url).href;
function trusted(event) {
  if (event.sender !== win?.webContents || event.senderFrame?.url !== page) throw Error('Janela inválida.');
}
ipcMain.handle('host', async event => {
  trusted(event);
  if (!server) {
    const candidate = createServer();
    await new Promise((resolve, reject) => {
      candidate.once('error', reject);
      candidate.listen(3000, '0.0.0.0', resolve);
    }).catch(() => { throw Error('A porta 3000 está ocupada. Feche outro anfitrião ou conecte-se ao servidor existente.'); });
    server = candidate;
  }
  const addresses = Object.values(networkInterfaces()).flat().filter(a => a.family === 'IPv4' && !a.internal).map(a => `http://${a.address}:3000`);
  return {endpoint: 'http://127.0.0.1:3000', addresses};
});
ipcMain.handle('request', async (event, {endpoint, path, token, body}) => {
  trusted(event);
  const base = new URL(endpoint);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.pathname !== '/' || base.search || base.hash) throw Error('Use um endereço como http://192.168.1.10:3000, sem caminho ou senha.');
  if (!/^\/api\/(create|join|action|state\?code=[A-Z0-9]{6})$/.test(path)) throw Error('Operação inválida.');
  const response = await fetch(new URL(path, base), {
    method: body === undefined ? 'GET' : 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
    headers: {'Content-Type': 'application/json', ...(token ? {Authorization: `Bearer ${token}`} : {})},
    body: body === undefined ? undefined : JSON.stringify(body)
  }).catch(() => { throw Error('Não foi possível conectar. Confira o endereço e se o anfitrião está aberto.'); });
  const result = await response.json().catch(() => { throw Error('O endereço não retornou uma resposta do jogo.'); });
  if (!response.ok) throw Error(result.error || 'Falha na operação.');
  return result;
});
app.whenReady().then(async () => {
  win = new BrowserWindow({width: 1440, height: 960, minWidth: 1100, minHeight: 760, show: process.env.METRALHOPOLE_SMOKE !== '1', fullscreen: process.env.METRALHOPOLE_SMOKE !== '1', backgroundColor: '#101827', title: 'Metralhopole', autoHideMenuBar: true,
    webPreferences: {preload: fileURLToPath(new URL('./preload.cjs', import.meta.url)), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false}});
  win.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  win.on('close', event => {
    if (server && dialog.showMessageBoxSync(win, {type: 'question', buttons: ['Continuar jogando', 'Fechar servidor'], defaultId: 0, cancelId: 0, message: 'Fechar o anfitrião encerra as salas hospedadas neste computador.'}) === 0) event.preventDefault();
  });
  await win.loadURL(page);
});
app.on('window-all-closed', () => { server?.close(); app.quit(); });
