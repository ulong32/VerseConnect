import { clipboard, dialog, ipcMain, nativeImage } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { getStore } from '../store.js';

/** Allowed image file extensions for clipboard copy */
const ALLOWED_CLIPBOARD_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.ico']);

/**
 * @param {() => import('electron').BrowserWindow | null} getMainWindow
 */
export function setupAppHandlers(getMainWindow) {
  // フォルダ選択ダイアログ
  ipcMain.handle('select-folder', async () => {
    const mainWindow = getMainWindow();
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  // ファイル選択ダイアログ
  ipcMain.handle('select-file', async (event, options) => {
    const mainWindow = getMainWindow();
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      defaultPath: options?.defaultPath,
      properties: ['openFile'],
      filters: options?.filters || [{ name: 'Images', extensions: ['webp', 'png', 'jpg', 'jpeg'] }]
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  // 設定を取得
  ipcMain.handle('get-settings', async () => {
    const store = getStore();
    return {
      folderPath: store.get('folderPath') || '',
      itemImageFolderPath: store.get('itemImageFolderPath') || '',
      customCharacters: store.get('customCharacters') || [],
      customTags: store.get('customTags') || []
    };
  });

  // 設定を保存
  ipcMain.handle('set-settings', async (event, settings) => {
    const store = getStore();
    if (settings.folderPath !== undefined) {
      store.set('folderPath', settings.folderPath);
    }
    if (settings.customCharacters !== undefined) {
      store.set('customCharacters', settings.customCharacters);
    }
    if (settings.customTags !== undefined) {
      store.set('customTags', settings.customTags);
    }
    if (settings.itemImageFolderPath !== undefined) {
      store.set('itemImageFolderPath', settings.itemImageFolderPath);
    }
    return true;
  });

  // Show confirmation dialog
  ipcMain.handle('show-confirm-dialog', async (event, options) => {
    const mainWindow = getMainWindow();
    const { title, message, okLabel, cancelLabel } = options;
    /** @type {import('electron').MessageBoxSyncOptions} */
    const dialogOptions = {
      type: 'warning',
      title: title || '確認',
      message: message || '',
      buttons: [cancelLabel || 'キャンセル', okLabel || 'OK'],
      defaultId: 0,
      cancelId: 0
    };
    const result = mainWindow
      ? dialog.showMessageBoxSync(mainWindow, dialogOptions)
      : dialog.showMessageBoxSync(dialogOptions);
    // Returns 0 for cancel (first button), 1 for ok (second button)
    return result === 1;
  });

  // Window controls
  ipcMain.on('window-minimize', () => {
    const mainWindow = getMainWindow();
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.on('window-maximize', () => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.on('window-close', () => {
    const mainWindow = getMainWindow();
    if (mainWindow) mainWindow.close();
  });

  // Copy image to clipboard
  ipcMain.handle('copy-image-to-clipboard', async (event, filePath) => {
    try {
      // Security: only allow image file extensions to prevent arbitrary file reads
      const ext = path.extname(filePath).toLowerCase();
      if (!ALLOWED_CLIPBOARD_EXTENSIONS.has(ext)) {
        return { success: false, error: '許可されていないファイル形式です' };
      }

      // Read the file and convert to nativeImage
      const buffer = await fs.readFile(filePath);
      const image = nativeImage.createFromBuffer(buffer);
      if (image.isEmpty()) {
        return { success: false, error: '画像の読み込みに失敗しました' };
      }
      clipboard.writeImage(image);
      return { success: true };
    } catch (error) {
      console.error('Failed to copy image to clipboard:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
}
