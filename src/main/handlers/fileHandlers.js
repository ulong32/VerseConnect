import { ipcMain, shell } from 'electron';
import * as fileService from '../services/fileService.js';

export function setupFileHandlers() {
  // フォルダ内の画像ファイル一覧を再帰的に取得（メタデータ付き）
  ipcMain.handle('get-images', async (event, folderPath) => {
    return fileService.scanFolder(folderPath);
  });

  // 画像のメタデータを取得
  ipcMain.handle('get-image-metadata', async (event, folderPath, imageName) => {
    if (!folderPath || !imageName) return null;
    const allMetadata = fileService.loadFolderMetadata(folderPath);
    return allMetadata[imageName] || null;
  });

  // 画像のメタデータを保存
  ipcMain.handle('set-image-metadata', async (event, folderPath, imageName, metadata) => {
    if (!folderPath || !imageName) return false;
    const allMetadata = fileService.loadFolderMetadata(folderPath);
    allMetadata[imageName] = metadata;
    return fileService.saveFolderMetadata(folderPath, allMetadata);
  });

  // ファイルをエクスプローラで表示
  ipcMain.handle('show-item-in-folder', async (event, filePath) => {
    if (!filePath) return false;
    shell.showItemInFolder(filePath);
    return true;
  });

  // フレンドカード画像を保存
  ipcMain.handle('save-friend-card', async (event, folderPath, filename, base64Data) => {
    return fileService.saveFriendCard(folderPath, filename, base64Data);
  });
}
