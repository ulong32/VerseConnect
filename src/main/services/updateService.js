import { app, ipcMain } from "electron";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pkg from "electron-updater";
const { autoUpdater } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get current application version safely (reads package.json in dev, falls back to app.getVersion())
 */
function getAppVersion() {
  try {
    const pkgPath = path.resolve(__dirname, "../../../package.json");
    const pkgJson = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    return pkgJson.version;
  } catch {
    return app.getVersion();
  }
}

/**
 * Setup auto-updater service in the Electron main process
 * @param {() => import('electron').BrowserWindow | null} getMainWindow
 * @param {{ autoCheck: boolean }} options
 */
export function setupUpdateService(getMainWindow, options = { autoCheck: true }) {
  // autoDownload: true means updates download immediately upon detection
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  // Setup logging (electron-updater has standard console output, but we can hook console)
  autoUpdater.logger = console;

  // Helper to send events to renderer process
  /**
   * @param {string} channel
   * @param {any} [data]
   */
  const sendToRenderer = (channel, data) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, data);
    }
  };

  // autoUpdater Events -> IPC Bridge
  autoUpdater.on("checking-for-update", () => {
    sendToRenderer("update-checking");
  });

  autoUpdater.on("update-available", (info) => {
    sendToRenderer("update-available", {
      version: info.version,
      releaseNotes: info.releaseNotes,
    });
  });

  autoUpdater.on("update-not-available", () => {
    sendToRenderer("update-not-available");
  });

  autoUpdater.on("download-progress", (progress) => {
    sendToRenderer("update-download-progress", {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      total: progress.total,
      transferred: progress.transferred,
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    sendToRenderer("update-downloaded", {
      version: info.version,
      releaseNotes: info.releaseNotes,
    });
  });

  autoUpdater.on("error", (err) => {
    sendToRenderer("update-error", err?.message || String(err));
  });

  // IPC Handlers from Renderer
  ipcMain.handle("get-app-version", () => {
    return getAppVersion();
  });

  ipcMain.handle("update-check", async () => {
    const { getStore } = await import("../store.js");
    const store = getStore();
    const debugMode = store.get("debugMode") === true;

    if (debugMode && !app.isPackaged) {
      console.log("[UpdateService] Debug mode: Simulating update flow for UI debugging");
      sendToRenderer("update-checking");

      setTimeout(() => {
        sendToRenderer("update-available", {
          version: "9.9.9",
          releaseNotes:
            "デバッグモードによる模擬アップデート通知です。進捗バーのアニメーションとバナーレイアウトを検証できます。",
        });

        let percent = 0;
        const interval = setInterval(() => {
          percent += 10;
          sendToRenderer("update-download-progress", { percent });

          if (percent >= 100) {
            clearInterval(interval);
            sendToRenderer("update-downloaded", { version: "9.9.9" });
          }
        }, 300);
      }, 1000);
      return;
    }

    if (!app.isPackaged) {
      // In development mode, mock update-not-available or just skip
      console.log("[UpdateService] Update check skipped in dev mode");
      setTimeout(() => {
        sendToRenderer("update-not-available");
      }, 1000);
      return;
    }
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      console.error("[UpdateService] Error checking for updates:", error);
      const message = error instanceof Error ? error.message : String(error);
      sendToRenderer("update-error", message);
    }
  });

  ipcMain.handle("update-download", async () => {
    if (!app.isPackaged) {
      console.log("[UpdateService] Update download skipped in dev mode");
      return;
    }
    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      console.error("[UpdateService] Error downloading update:", error);
      const message = error instanceof Error ? error.message : String(error);
      sendToRenderer("update-error", message);
    }
  });

  ipcMain.handle("update-install", () => {
    if (!app.isPackaged) {
      console.log("[UpdateService] App quit and install skipped in dev mode");
      return;
    }
    autoUpdater.quitAndInstall();
  });

  // Initial auto-check on startup if enabled and packaged
  if (options.autoCheck && app.isPackaged) {
    // Wait for the app to be fully ready and window to load
    app.whenReady().then(() => {
      setTimeout(() => {
        console.log("[UpdateService] Initial update check triggered");
        autoUpdater.checkForUpdates().catch((err) => {
          console.error("[UpdateService] Failed initial update check:", err);
        });
      }, 5000); // 5 seconds delay to not block startup
    });
  }
}
