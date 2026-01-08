import { dialog, ipcMain } from 'electron';
import { getStore } from '../store.js';

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

  // 設定を取得
  ipcMain.handle('get-settings', async () => {
    const store = getStore();
    return {
      folderPath: store.get('folderPath') || '',
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
}
