// frontend/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  imprimirContenido: (htmlContent) => {
    ipcRenderer.send('imprimir-contenido', htmlContent);
  }
});