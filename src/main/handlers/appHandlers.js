import { logger } from "../utils/logger.js";
import { clipboard, dialog, ipcMain, nativeImage } from "electron";
import path from "path";
import fs from "fs/promises";
import { getStore } from "../store.js";

const log = logger.withSource("AppHandlers");

/** Allowed image file extensions for clipboard copy */
const ALLOWED_CLIPBOARD_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".bmp",
  ".ico",
]);

/**
 * @param {() => import('electron').BrowserWindow | null} getMainWindow
 */
export function setupAppHandlers(getMainWindow) {
  // フォルダ選択ダイアログ
  ipcMain.handle("select-folder", async () => {
    log.log("select-folder called");
    const mainWindow = getMainWindow();
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"],
    });
    if (result.canceled || result.filePaths.length === 0) {
      log.log("select-folder cancelled");
      return null;
    }
    log.log("select-folder selected:", result.filePaths[0]);
    return result.filePaths[0];
  });

  // ファイル選択ダイアログ
  ipcMain.handle("select-file", async (event, options) => {
    log.log("select-file called with options:", options);
    const mainWindow = getMainWindow();
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      defaultPath: options?.defaultPath,
      properties: ["openFile"],
      filters: options?.filters || [{ name: "Images", extensions: ["webp", "png", "jpg", "jpeg"] }],
    });
    if (result.canceled || result.filePaths.length === 0) {
      log.log("select-file cancelled");
      return null;
    }
    log.log("select-file selected:", result.filePaths[0]);
    return result.filePaths[0];
  });

  // ファイル保存ダイアログ
  ipcMain.handle("save-file-dialog", async (event, options) => {
    const mainWindow = getMainWindow();
    const dialogOptions = {
      defaultPath: options?.defaultPath,
      filters: options?.filters || [{ name: "Images", extensions: ["png"] }],
    };
    const result = mainWindow
      ? await dialog.showSaveDialog(mainWindow, dialogOptions)
      : await dialog.showSaveDialog(dialogOptions);

    if (result.canceled || !result.filePath) {
      return null;
    }
    return result.filePath;
  });

  // 設定を取得
  ipcMain.handle("get-settings", async () => {
    log.log("get-settings called");
    const store = getStore();
    return {
      folderPath: store.get("folderPath") || "",
      itemImageFolderPath: store.get("itemImageFolderPath") || "",
      customCharacters: store.get("customCharacters") || [],
      customTags: store.get("customTags") || [],
      autoUpdateCheck: store.get("autoUpdateCheck") !== false,
      debugMode: store.get("debugMode") === true,
      bgRemovalAlgorithm: store.get("bgRemovalAlgorithm") || "rmbg",
    };
  });

  // 設定を保存
  ipcMain.handle("set-settings", async (event, settings) => {
    log.log("set-settings called with keys:", Object.keys(settings));
    const store = getStore();
    if (settings.folderPath !== undefined) {
      store.set("folderPath", settings.folderPath);
    }
    if (settings.customCharacters !== undefined) {
      store.set("customCharacters", settings.customCharacters);
    }
    if (settings.customTags !== undefined) {
      store.set("customTags", settings.customTags);
    }
    if (settings.itemImageFolderPath !== undefined) {
      store.set("itemImageFolderPath", settings.itemImageFolderPath);
    }
    if (settings.autoUpdateCheck !== undefined) {
      store.set("autoUpdateCheck", settings.autoUpdateCheck);
    }
    if (settings.debugMode !== undefined) {
      store.set("debugMode", settings.debugMode);
    }
    if (settings.bgRemovalAlgorithm !== undefined) {
      store.set("bgRemovalAlgorithm", settings.bgRemovalAlgorithm);
    }
    return true;
  });

  // Show confirmation dialog
  ipcMain.handle("show-confirm-dialog", async (event, options) => {
    const mainWindow = getMainWindow();
    const { title, message, okLabel, cancelLabel } = options;
    log.log("show-confirm-dialog called:", { title, message });
    /** @type {import('electron').MessageBoxSyncOptions} */
    const dialogOptions = {
      type: "warning",
      title: title || "確認",
      message: message || "",
      buttons: [cancelLabel || "キャンセル", okLabel || "OK"],
      defaultId: 0,
      cancelId: 0,
    };
    const result = mainWindow
      ? dialog.showMessageBoxSync(mainWindow, dialogOptions)
      : dialog.showMessageBoxSync(dialogOptions);
    // Returns 0 for cancel (first button), 1 for ok (second button)
    log.log("show-confirm-dialog result:", result === 1);
    return result === 1;
  });

  // Window controls
  ipcMain.on("window-minimize", () => {
    log.log("window-minimize event received");
    const mainWindow = getMainWindow();
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.on("window-maximize", () => {
    log.log("window-maximize event received");
    const mainWindow = getMainWindow();
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.on("window-close", () => {
    log.log("window-close event received");
    const mainWindow = getMainWindow();
    if (mainWindow) mainWindow.close();
  });

  // Copy image to clipboard
  ipcMain.handle("copy-image-to-clipboard", async (event, filePath) => {
    log.log("copy-image-to-clipboard called for:", filePath);
    try {
      // Security: only allow image file extensions to prevent arbitrary file reads
      const ext = path.extname(filePath).toLowerCase();
      if (!ALLOWED_CLIPBOARD_EXTENSIONS.has(ext)) {
        log.warn("copy-image-to-clipboard forbidden file extension:", ext);
        return { success: false, error: "許可されていないファイル形式です" };
      }

      // Read the file and convert to nativeImage
      const buffer = await fs.readFile(filePath);
      const image = nativeImage.createFromBuffer(buffer);
      if (image.isEmpty()) {
        log.error("copy-image-to-clipboard image is empty/corrupt:", filePath);
        return { success: false, error: "画像の読み込みに失敗しました" };
      }
      clipboard.writeImage(image);
      log.log("copy-image-to-clipboard success for:", filePath);
      return { success: true };
    } catch (error) {
      log.error("Failed to copy image to clipboard:", error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
}
