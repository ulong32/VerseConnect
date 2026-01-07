import { app, protocol, net, ipcMain } from 'electron';
import serve from 'electron-serve';
import path from 'path';
import { pathToFileURL } from 'url';
import { initStore } from './store.js';
import { setupAipriHandlers } from './handlers/aipriHandlers.js';
import { setupFileHandlers } from './handlers/fileHandlers.js';
import { setupAppHandlers } from './handlers/appHandlers.js';
import { createWindow, getMainWindow } from './windowManager.js';

const serveURL = serve({ directory: '.' });
const port = process.env.PORT || 5173;
const dev = !app.isPackaged;

// カスタムプロトコルの登録（appのreadyイベント前に呼ぶ必要がある）
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-image',
    privileges: {
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      stream: true
    }
  }
]);

/**
 * @param {number | string} port
 */
function loadVite(port) {
  const mainWindow = getMainWindow();
  if (!mainWindow) return;
  mainWindow.loadURL(`http://localhost:${port}`).catch((e) => {
    console.log('Error loading URL, retrying', e);
    setTimeout(() => {
      loadVite(port);
    }, 200);
  });
}

function createMainWindow() {
  const mainWindow = createWindow(dev);

  if (dev) loadVite(port);
  else serveURL(mainWindow);
}

app.once('ready', async () => {
  // カスタムプロトコルハンドラーを登録
  protocol.handle('local-image', (request) => {
    // Strip query parameters and decode file path
    const urlWithoutProtocol = request.url.replace('local-image://', '');
    const urlWithoutQuery = urlWithoutProtocol.split('?')[0];
    const filePath = decodeURIComponent(urlWithoutQuery);
    return net.fetch(pathToFileURL(filePath).toString());
  });

  await initStore();

  // Setup IPC Handlers
  setupFileHandlers(getMainWindow);
  setupAipriHandlers();
  setupAppHandlers(getMainWindow);

  createMainWindow();
});

app.on('activate', () => {
  if (!getMainWindow()) {
    createMainWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Legacy test IPC
ipcMain.on('to-main', (event, count) => {
  const mainWindow = getMainWindow();
  if (!mainWindow) return;
  return mainWindow.webContents.send('from-main', `next count is ${count + 1}`);
});
