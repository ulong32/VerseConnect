import { app, ipcMain, net, protocol } from 'electron';
import serve from 'electron-serve';
import path from 'path';
import { pathToFileURL } from 'url';
import { setupAipriHandlers } from './handlers/aipriHandlers.js';
import { setupAppHandlers } from './handlers/appHandlers.js';
import { setupFileHandlers } from './handlers/fileHandlers.js';
import { initStore } from './store.js';
import { createWindow, getMainWindow } from './windowManager.js';

/** Allowed image file extensions for the local-image:// protocol */
const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.ico']);

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
      stream: true
    }
  },
  {
    scheme: 'item-image',
    privileges: {
      secure: true,
      supportFetchAPI: true,
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

    // Security: only allow image file extensions to prevent arbitrary file reads
    const ext = path.extname(filePath).toLowerCase();
    if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
      return new Response('Forbidden', { status: 403 });
    }

    return net.fetch(pathToFileURL(filePath).toString());
  });

  // アイテム画像用カスタムプロトコルハンドラー
  protocol.handle('item-image', async (request) => {
    const { getStore } = await import('./store.js');
    const store = getStore();
    const itemImageFolderPath = store.get('itemImageFolderPath');

    if (!itemImageFolderPath) {
      // Return 404 if no folder configured
      return new Response('Item image folder not configured', { status: 404 });
    }

    // URL format: item-image://path/to/item_suffix.webp
    const urlWithoutProtocol = request.url.replace('item-image://', '');
    const urlWithoutQuery = urlWithoutProtocol.split('?')[0];
    const relativePath = decodeURIComponent(urlWithoutQuery);

    // Construct the full file path and normalize it
    const resolvedBase = path.resolve(itemImageFolderPath);
    const filePath = path.resolve(resolvedBase, relativePath);

    // Security: ensure the resolved path stays within the configured folder
    // Use case-insensitive comparison on Windows where paths are case-insensitive
    const normalizedBase = resolvedBase.toLowerCase();
    const normalizedFilePath = filePath.toLowerCase();
    if (!normalizedFilePath.startsWith(normalizedBase + path.sep) && normalizedFilePath !== normalizedBase) {
      return new Response('Forbidden', { status: 403 });
    }

    // Security: only allow image file extensions
    const ext = path.extname(filePath).toLowerCase();
    if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
      return new Response('Forbidden', { status: 403 });
    }

    return net.fetch(pathToFileURL(filePath).toString());
  });

  await initStore();

  // Setup IPC Handlers
  setupFileHandlers();
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
