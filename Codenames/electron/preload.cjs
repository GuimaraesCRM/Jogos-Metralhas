/**
 * Preload — roda com o sandbox ligado, por isso é CommonJS: exigência do Electron.
 *
 * A interface conversa com o servidor por WebSocket, que é uma API do próprio
 * navegador. Quase nada precisa atravessar a ponte: só os comandos da janela,
 * já que o app usa barra de título própria em vez da moldura do sistema.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('appDesktop', {
  versao: () => ipcRenderer.invoke('app:versao'),
  plataforma: process.platform,

  janela: {
    minimizar: () => ipcRenderer.send('janela:minimizar'),
    alternarMaximizar: () => ipcRenderer.send('janela:alternar-maximizar'),
    fechar: () => ipcRenderer.send('janela:fechar'),
    estaMaximizada: () => ipcRenderer.invoke('janela:esta-maximizada'),
    // Avisa quando o usuário maximiza/restaura pelo teclado ou arrastando.
    aoMudarMaximizacao: (retorno) => {
      const ouvinte = (_evento, maximizada) => retorno(maximizada);
      ipcRenderer.on('janela:maximizacao', ouvinte);
      return () => ipcRenderer.removeListener('janela:maximizacao', ouvinte);
    }
  }
});
