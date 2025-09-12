// frontend/preload.js
const { contextBridge, ipcRenderer } = require('electron');

// Exponer solo lo necesario al renderer (por seguridad)
contextBridge.exposeInMainWorld('electronAPI', {
    // Puedes añadir funciones IPC si las necesitas más adelante
});