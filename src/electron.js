import windowStateManager from 'electron-window-state';
import { app, BrowserWindow, ipcMain, dialog, protocol, net, shell } from 'electron';
import contextMenu from 'electron-context-menu';
import serve from 'electron-serve';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import { fileURLToPath, pathToFileURL } from 'url';

// ESMでは__dirnameが使えないので、代替手段を使用
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// electron-storeはESMで動的インポート
/** @type {import('electron-store').default<{folderPath: string, customCharacters: string[]}> | undefined} */
let store;
async function initStore() {
  const Store = (await import('electron-store')).default;
  store = new Store({
    defaults: {
      folderPath: '',
      customCharacters: []
    }
  });
}

// 画像ファイルの拡張子
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.ico'];

const serveURL = serve({ directory: '.' });
const port = process.env.PORT || 5173;
const dev = !app.isPackaged;
/** @type {BrowserWindow | null} */
let mainWindow = null;

function createWindow() {
  let windowState = windowStateManager({
    defaultWidth: 800,
    defaultHeight: 600,
  });

  const mainWindow = new BrowserWindow({
    backgroundColor: 'whitesmoke',
    titleBarStyle: 'default',
    autoHideMenuBar: true,
    trafficLightPosition: {
      x: 17,
      y: 32,
    },
    minHeight: 450,
    minWidth: 500,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      devTools: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    x: windowState.x,
    y: windowState.y,
    width: windowState.width,
    height: windowState.height,
  });

  windowState.manage(mainWindow);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('close', () => {
    windowState.saveState(mainWindow);
  });

  return mainWindow;
}

contextMenu({
  showLookUpSelection: false,
  showSearchWithGoogle: false,
  showCopyImage: false,
  prepend: (defaultActions, params, browserWindow) => [
    {
      label: 'Make App 💻',
    },
  ],
});

/**
 * @param {number | string} port
 */
function loadVite(port) {
  if (!mainWindow) return;
  mainWindow.loadURL(`http://localhost:${port}`).catch((e) => {
    console.log('Error loading URL, retrying', e);
    setTimeout(() => {
      loadVite(port);
    }, 200);
  });
}

function createMainWindow() {
  mainWindow = createWindow();
  mainWindow.once('close', () => {
    mainWindow = null;
  });

  if (dev) loadVite(port);
  else serveURL(mainWindow);
}

// IPC Handlers
function setupIpcHandlers() {
  // フォルダ選択ダイアログ
  ipcMain.handle('select-folder', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  /**
   * ファイル名から日付と連番を抽出
   * Pattern: aipriverse_album_YYYYMMDD_N.ext or aipriverse_album_YYYYMM-DD_N.ext
   * @param {string} filename
   * @returns {{ date: string | null, serial: number | null }}
   */
  const parseFilename = (filename) => {
    // Pattern 1: aipriverse_album_YYYYMMDD_N (e.g., aipriverse_album_20240404_123.jpg)
    // Pattern 2: aipriverse_album_YYYYMM-DD_N (e.g., aipriverse_album_202409-26_123.jpg)
    const match = filename.match(/aipriverse_album_(\d{4})(\d{2})-?(\d{2})_(\d+)/);

    if (match) {
      const year = match[1];
      const month = match[2];
      const day = match[3];
      const serial = parseInt(match[4], 10);

      return {
        date: `${year}-${month}-${day}`,
        serial: serial
      };
    }

    return { date: null, serial: null };
  };

  // フォルダ内の画像ファイル一覧を再帰的に取得（メタデータ付き）
  ipcMain.handle('get-images', async (event, folderPath) => {
    if (!folderPath || !fs.existsSync(folderPath)) {
      return [];
    }

    /**
     * 再帰的にフォルダを走査して画像を収集
     * @param {string} currentPath - 現在のフォルダパス
     * @param {string} relativePath - ルートからの相対パス
     * @returns {Array<{name: string, path: string, url: string, metadata: object|null, folder: string}>} 画像情報の配列
     */
    const scanFolder = (currentPath, relativePath = '') => {
      /** @type {Array<{name: string, path: string, url: string, metadata: object|null, folder: string}>} */
      const images = [];

      try {
        const entries = fs.readdirSync(currentPath, { withFileTypes: true });

        // Load metadata for current folder
        const metadataPath = path.join(currentPath, '.image_metadata.json');
        /** @type {Record<string, any>} */
        let folderMetadata = {};
        try {
          if (fs.existsSync(metadataPath)) {
            const data = fs.readFileSync(metadataPath, 'utf-8');
            folderMetadata = JSON.parse(data);
          }
        } catch (err) {
          console.error('Error reading metadata:', err);
        }

        for (const entry of entries) {
          const entryPath = path.join(currentPath, entry.name);

          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'friend_card') {
            // 再帰的にサブフォルダを走査（friend_cardは除外）
            const subRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
            images.push(...scanFolder(entryPath, subRelativePath));
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (IMAGE_EXTENSIONS.includes(ext)) {
              // Extract date and serial from filename
              // Pattern: aipriverse_album_YYYYMMDD_N.jpg or aipriverse_album_YYYY-MM-DD_N.jpg
              const parsed = parseFilename(entry.name);

              images.push({
                name: entry.name,
                path: entryPath,
                url: `local-image://${encodeURIComponent(entryPath)}`,
                metadata: folderMetadata[entry.name] || null,
                folder: relativePath,
                extractedDate: parsed.date,
                serial: parsed.serial
              });
            }
          }
        }
      } catch (error) {
        console.error('Error scanning folder:', currentPath, error);
      }

      return images;
    };

    try {
      return scanFolder(folderPath);
    } catch (error) {
      console.error('Error reading folder:', error);
      return [];
    }
  });

  // 設定を取得
  ipcMain.handle('get-settings', async () => {
    return {
      folderPath: store?.get('folderPath') || '',
      customCharacters: store?.get('customCharacters') || []
    };
  });

  // 設定を保存
  ipcMain.handle('set-settings', async (event, settings) => {
    if (settings.folderPath !== undefined) {
      store?.set('folderPath', settings.folderPath);
    }
    if (settings.customCharacters !== undefined) {
      store?.set('customCharacters', settings.customCharacters);
    }
    return true;
  });

  // メタデータファイルのパスを取得
  /** @param {string} folderPath */
  const getMetadataFilePath = (folderPath) => {
    return path.join(folderPath, '.image_metadata.json');
  };

  // フォルダ内の全メタデータを読み込む
  /** @param {string} folderPath */
  const loadFolderMetadata = (folderPath) => {
    const metadataPath = getMetadataFilePath(folderPath);
    try {
      if (fs.existsSync(metadataPath)) {
        const data = fs.readFileSync(metadataPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error reading metadata file:', error);
    }
    return {};
  };

  // フォルダ内の全メタデータを保存
  /**
   * @param {string} folderPath
   * @param {Object} metadata
   */
  const saveFolderMetadata = (folderPath, metadata) => {
    const metadataPath = getMetadataFilePath(folderPath);
    try {
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
      return true;
    } catch (error) {
      console.error('Error writing metadata file:', error);
      return false;
    }
  };

  // 画像のメタデータを取得
  ipcMain.handle('get-image-metadata', async (event, folderPath, imageName) => {
    if (!folderPath || !imageName) return null;
    const allMetadata = loadFolderMetadata(folderPath);
    return allMetadata[imageName] || null;
  });

  // 画像のメタデータを保存
  ipcMain.handle('set-image-metadata', async (event, folderPath, imageName, metadata) => {
    if (!folderPath || !imageName) return false;
    const allMetadata = loadFolderMetadata(folderPath);
    allMetadata[imageName] = metadata;
    return saveFolderMetadata(folderPath, allMetadata);
  });

  // ZIPファイルを解凍して画像を抽出
  ipcMain.handle('extract-zip', async (event, zipPath, targetFolder) => {
    if (!zipPath || !targetFolder) {
      return { success: false, error: 'Invalid parameters', extracted: 0 };
    }

    try {
      const zip = new AdmZip(zipPath);
      const entries = zip.getEntries();
      let extractedCount = 0;

      for (const entry of entries) {
        // Skip directories
        if (entry.isDirectory) continue;

        // Get just the filename (ignore folder structure in ZIP)
        const filename = path.basename(entry.entryName);

        // Check if it's an image
        const ext = path.extname(filename).toLowerCase();
        if (!['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.avif'].includes(ext)) {
          continue;
        }

        // Skip hidden files and macOS metadata
        if (filename.startsWith('.') || filename.startsWith('__MACOSX')) {
          continue;
        }

        // Extract to target folder
        const targetPath = path.join(targetFolder, filename);

        // Avoid overwriting existing files
        if (fs.existsSync(targetPath)) {
          console.log('Skipping existing file:', filename);
          continue;
        }

        const content = entry.getData();
        fs.writeFileSync(targetPath, content);
        extractedCount++;
      }

      return { success: true, extracted: extractedCount };
    } catch (error) {
      console.error('Error extracting ZIP:', error);
      return { success: false, error: String(error), extracted: 0 };
    }
  });

  // ファイルをエクスプローラで表示
  ipcMain.handle('show-item-in-folder', async (event, filePath) => {
    if (!filePath) return false;
    shell.showItemInFolder(filePath);
    return true;
  });

  // フレンドカード画像を保存
  ipcMain.handle('save-friend-card', async (event, folderPath, filename, base64Data) => {
    if (!folderPath || !filename || !base64Data) {
      return { success: false, error: 'Invalid parameters' };
    }

    try {
      // Create friend_card directory if it doesn't exist
      const friendCardDir = path.join(folderPath, 'friend_card');
      if (!fs.existsSync(friendCardDir)) {
        fs.mkdirSync(friendCardDir, { recursive: true });
      }

      // Convert base64 to buffer and save
      const buffer = Buffer.from(base64Data, 'base64');
      const targetPath = path.join(friendCardDir, filename);
      fs.writeFileSync(targetPath, buffer);

      return { success: true, filename };
    } catch (error) {
      console.error('Error saving friend card:', error);
      return { success: false, error: String(error) };
    }
  });
}

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

app.once('ready', async () => {
  // カスタムプロトコルハンドラーを登録
  protocol.handle('local-image', (request) => {
    const filePath = decodeURIComponent(request.url.replace('local-image://', ''));
    return net.fetch(pathToFileURL(filePath).toString());
  });

  await initStore();
  setupIpcHandlers();
  createMainWindow();
});

app.on('activate', () => {
  if (!mainWindow) {
    createMainWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('to-main', (event, count) => {
  if (!mainWindow) return;
  return mainWindow.webContents.send('from-main', `next count is ${count + 1}`);
});
