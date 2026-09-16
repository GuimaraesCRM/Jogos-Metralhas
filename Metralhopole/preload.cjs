const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  host: () => ipcRenderer.invoke('host'),
  request: args => ipcRenderer.invoke('request', args)
});
