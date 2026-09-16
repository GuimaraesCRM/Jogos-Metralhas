/**
 * Processo principal do Electron.
 *
 * Duas responsabilidades:
 *  1. Servir a interface por um protocolo próprio (app://) em vez de file://.
 *     Isso importa: em file:// o Chromium recusa módulos ES por CORS e trata o
 *     localStorage como origem nula — e é no localStorage que fica o crachá que
 *     devolve o jogador à partida depois de uma queda de conexão.
 *  2. Abrir a janela (ou várias, em desenvolvimento) com o sandbox ligado.
 *
 * Arquivo em CommonJS (.cjs) de propósito, mesmo com o resto do projeto em
 * módulos ES: no processo principal, `require('electron')` acerta o módulo
 * embutido, enquanto `import 'electron'` resolve para o pacote do npm, que só
 * devolve o caminho do executável.
 */

const { app, BrowserWindow, Menu, shell, protocol, net, ipcMain } = require('electron');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

// Nome e identidade da janela na barra de tarefas do Windows. Sem isso o app
// aparece como "Electron" enquanto não está empacotado.
app.setName('Palavras Secretas');
if (process.platform === 'win32') app.setAppUserModelId('com.palavrassecretas.app');

const RAIZ_RENDERER = path.join(__dirname, '..', 'renderer');
// A interface importa as regras e o protocolo de shared/, que fica fora de
// renderer/. Servir as duas pastas pelo mesmo protocolo evita duplicar código.
const RAIZ_SHARED = path.join(__dirname, '..', 'shared');
const EH_DEV = !app.isPackaged;

// Sem isso o app:// seria tratado como esquema exótico: sem origem própria, sem
// fetch e sem módulos ES. As permissões abaixo o deixam equivalente a https://.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
  }
]);

/** Quantas janelas abrir. `npm run dev` passa --janelas=4 para testar sozinho. */
function quantidadeDeJanelas() {
  const arg = process.argv.find((a) => a.startsWith('--janelas='));
  if (!arg) return 1;
  const n = Number.parseInt(arg.split('=')[1], 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), 8) : 1;
}

/**
 * Traduz app://local/<caminho> para um arquivo do app.
 * O normalize somado à conferência do prefixo barra travessia de diretório
 * (app://local/../../qualquer-coisa-fora-do-app).
 */
function registrarProtocoloApp() {
  protocol.handle('app', (requisicao) => {
    const url = new URL(requisicao.url);
    const relativo = decodeURIComponent(url.pathname);

    const ehShared = relativo.startsWith('/shared/');
    const raiz = ehShared ? RAIZ_SHARED : RAIZ_RENDERER;
    const dentro = ehShared ? relativo.slice('/shared'.length) : relativo;
    const destino = path.normalize(path.join(raiz, dentro));

    if (!destino.startsWith(raiz)) {
      return new Response('Acesso negado', { status: 403 });
    }
    return net.fetch(pathToFileURL(destino).toString());
  });
}

function criarJanela(indice = 0) {
  const janela = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 880,
    minHeight: 620,
    // Em desenvolvimento as janelas ficam em cascata para não se empilharem.
    x: EH_DEV && indice > 0 ? 60 + indice * 42 : undefined,
    y: EH_DEV && indice > 0 ? 50 + indice * 34 : undefined,
    show: false,
    backgroundColor: '#14100e',
    title: 'Palavras Secretas',
    // Sem moldura do sistema: a barra de título é desenhada pelo próprio jogo,
    // no mesmo visual do resto da interface.
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  // Evita o flash branco: a janela só aparece com a primeira pintura pronta.
  janela.once('ready-to-show', () => janela.show());
  janela.loadURL('app://local/index.html');

  // Links externos abrem no navegador do sistema, nunca dentro do jogo.
  janela.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // A barra de título precisa saber o estado real para trocar o ícone de
  // maximizar — o usuário também maximiza com duplo clique ou atalho.
  const avisarMaximizacao = () =>
    janela.webContents.send('janela:maximizacao', janela.isMaximized());
  janela.on('maximize', avisarMaximizacao);
  janela.on('unmaximize', avisarMaximizacao);

  return janela;
}

app.whenReady().then(() => {
  registrarProtocoloApp();
  Menu.setApplicationMenu(null);
  ipcMain.handle('app:versao', () => app.getVersion());

  // Comandos da barra de título própria. `BrowserWindow.fromWebContents` garante
  // que cada janela controle a si mesma, o que importa no modo de várias janelas.
  const daMensagem = (evento) => BrowserWindow.fromWebContents(evento.sender);
  ipcMain.on('janela:minimizar', (e) => daMensagem(e)?.minimize());
  ipcMain.on('janela:fechar', (e) => daMensagem(e)?.close());
  ipcMain.on('janela:alternar-maximizar', (e) => {
    const janela = daMensagem(e);
    if (!janela) return;
    if (janela.isMaximized()) janela.unmaximize();
    else janela.maximize();
  });
  ipcMain.handle('janela:esta-maximizada', (e) => daMensagem(e)?.isMaximized() ?? false);

  const total = quantidadeDeJanelas();
  for (let i = 0; i < total; i++) criarJanela(i);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) criarJanela();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
