// backend/main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');

let mainWindow;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile('frontend/login.html');
  win.webContents.openDevTools();
  return win;
}

/* ===============================
   IMPRESIÓN HTML (opcional)
   =============================== */
ipcMain.on('imprimir-contenido', (event, htmlContent) => {
  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      offscreen: true
    }
  });

  printWindow.loadURL(`data:text/html;charset=utf-8,
    <html>
      <body style="margin:0;font-family:Arial;font-size:11px;">
        ${htmlContent}
      </body>
    </html>
  `);

  printWindow.webContents.on('did-finish-load', () => {
    printWindow.webContents.print({
      silent: true,
      printBackground: true,
      deviceName: 'Ribetec RT-420ME',
      margins: { margintype: 'custom', top: 0, bottom: 0, left: 0, right: 0 }
    }, (success, errorType) => {
      if (!success) {
        console.error('Error de impresión HTML:', errorType);
      }
      printWindow.close();
    });
  });
});

/* ===============================
   IMPRESIÓN TSPL (LA BUENA)
   =============================== */
ipcMain.on('imprimir-tspl', (event, tspl) => {
  const tmpFile = path.join(os.tmpdir(), `label_${Date.now()}.txt`);

  fs.writeFileSync(tmpFile, tspl, 'utf8');

  exec(`copy /B "${tmpFile}" "\\\\localhost\\RibetecRT420"`, (err) => {
    if (err) {
      console.error('Error enviando TSPL:', err);
    }
    fs.unlinkSync(tmpFile);
  });
});

/* ===============================
   INICIO APP
   =============================== */
app.whenReady().then(() => {
  mainWindow = createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
