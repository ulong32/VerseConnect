import { logger } from "../utils/logger.js";
import { ipcMain, shell } from "electron";
import * as fileService from "../services/fileService.js";
import { getBackgroundMask } from "../services/bgRemovalService.js";
import fs from "fs/promises";
import { getStore } from "../store.js";

const log = logger.withSource("FileHandlers");

export function setupFileHandlers() {
  // フォルダ内の画像ファイル一覧を再帰的に取得（メタデータ付き）
  ipcMain.handle("get-images", async (event, folderPath) => {
    log.log("get-images called for path:", folderPath);
    try {
      const result = fileService.scanFolder(folderPath);
      log.log(`get-images finished. Found ${result?.length || 0} images.`);
      return result;
    } catch (error) {
      log.error("get-images error:", error);
      throw error;
    }
  });

  // 画像のメタデータを取得
  ipcMain.handle("get-image-metadata", async (event, folderPath, imageName) => {
    log.log("get-image-metadata called for:", { folderPath, imageName });
    if (!folderPath || !imageName) {
      log.warn("get-image-metadata: missing folderPath or imageName");
      return null;
    }
    const allMetadata = fileService.loadFolderMetadata(folderPath);
    return allMetadata[imageName] || null;
  });

  // 画像のメタデータを保存
  ipcMain.handle("set-image-metadata", async (event, folderPath, imageName, metadata) => {
    log.log("set-image-metadata called for:", { folderPath, imageName });
    if (!folderPath || !imageName) {
      log.warn("set-image-metadata: missing folderPath or imageName");
      return false;
    }
    const allMetadata = fileService.loadFolderMetadata(folderPath);
    allMetadata[imageName] = metadata;
    return fileService.saveFolderMetadata(folderPath, allMetadata);
  });

  // ファイルをエクスプローラで表示
  ipcMain.handle("show-item-in-folder", async (event, filePath) => {
    log.log("show-item-in-folder called for:", filePath);
    if (!filePath) {
      log.warn("show-item-in-folder: empty filePath");
      return false;
    }
    shell.showItemInFolder(filePath);
    return true;
  });

  // フレンドカード画像を保存
  ipcMain.handle("save-friend-card", async (event, folderPath, filename, base64Data) => {
    log.log("save-friend-card called for filename:", filename, "in:", folderPath);
    return fileService.saveFriendCard(folderPath, filename, base64Data);
  });

  // フレンドカード画像を削除
  ipcMain.handle("delete-friend-card", async (event, folderPath, filename) => {
    log.log("delete-friend-card called for filename:", filename, "in:", folderPath);
    return fileService.deleteFriendCard(folderPath, filename);
  });

  // 背景透過処理を実行してマスクを取得
  ipcMain.handle("get-background-mask", async (event, imageData) => {
    if (!imageData) return null;
    const store = getStore();
    const algorithm = store.get("bgRemovalAlgorithm") || "rmbg";
    return await getBackgroundMask(imageData, algorithm);
  });

  // 透過画像を保存
  ipcMain.handle("save-transparent-image", async (event, filePath, base64Data) => {
    try {
      if (!filePath || !base64Data) return { success: false, error: "Invalid parameters" };
      const buffer = Buffer.from(base64Data, "base64");
      await fs.writeFile(filePath, buffer);
      return { success: true };
    } catch (error) {
      console.error("Error saving transparent image:", error);
      return { success: false, error: String(error) };
    }
  });
}
