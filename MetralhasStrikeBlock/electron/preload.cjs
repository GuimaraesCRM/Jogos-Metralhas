/**
 * Preload — roda com o sandbox ligado, por isso é CommonJS: exigência do Electron.
 *
 * A interface conversa com o servidor por WebSocket, que é uma API do próprio
 * navegador. Quase nada precisa atravessar a ponte: a identidade do launcher e
 * o alternador de tela cheia (F11).
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('appDesktop', {
  versao: () => ipcRenderer.invoke('app:versao'),
  plataforma: process.platform,

  // Identidade entregue pelo launcher do bundle, quando ele existir.
  // Devolve { nome, avatar, sala, origem } ou null. Veja o comentário em
  // electron/identidade-launcher.cjs, que é onde o contrato é lido.
  launcher: {
    identidade: () => ipcRenderer.invoke('launcher:identidade')
  },

  janela: {
    alternarTelaCheia: () => ipcRenderer.send('janela:alternar-tela-cheia')
  }
});
