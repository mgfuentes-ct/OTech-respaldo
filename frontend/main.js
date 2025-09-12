// frontend/main.js
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow () {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), 
      contextIsolation: true, // Siempre en true por seguridad
      nodeIntegration: false  // Nunca true! Usamos preload en su lugar.
    }
  });

  win.loadFile('frontend/index.html');
  win.webContents.openDevTools(); // Opcional: abre consola automáticamente
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});