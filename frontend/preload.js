
const { contextBridge, ipcRenderer } = require('electron');
const { BrowserWindow } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Función para imprimir contenido HTML
    imprimirContenido: (htmlContent) => {
        const win = BrowserWindow.getFocusedWindow();
        if (win) {
            win.webContents.print({
                silent: false, // Cambia a true para impresión automática sin diálogo
                printBackground: true,
                deviceName: '', // Nombre de la impresora (dejar vacío para usar predeterminada)
                pageSize: 'A7' // Tamaño pequeño para etiquetas
            }, (success, failureReason) => {
                if (!success) console.error('Error al imprimir:', failureReason);
            });
        }
    },
    
    // Opcional: Función para obtener lista de impresoras
    obtenerImpresoras: () => {
        return new Promise((resolve) => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) {
                win.webContents.getPrintersAsync().then(printers => {
                    resolve(printers);
                });
            } else {
                resolve([]);
            }
        });
    }
});