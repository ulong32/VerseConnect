import { logger } from "./utils/logger.js";
import { app, ipcMain, net, protocol } from "electron";

const log = logger.withSource("Main");
import serve from "electron-serve";
import path from "path";
import { pathToFileURL } from "url";
import { setupAipriHandlers } from "./handlers/aipriHandlers.js";
import { setupAppHandlers } from "./handlers/appHandlers.js";
import { setupFileHandlers } from "./handlers/fileHandlers.js";
import { setupUpdateService } from "./services/updateService.js";
import { getStore, initStore } from "./store.js";
import { createWindow, getMainWindow } from "./windowManager.js";

/** Allowed image file extensions for the local-image:// protocol */
const ALLOWED_IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".bmp",
  ".ico",
]);

const serveURL = serve({ directory: "." });
const port = process.env.PORT || 5173;
const dev = !app.isPackaged;

// カスタムプロトコルの登録（appのreadyイベント前に呼ぶ必要がある）
protocol.registerSchemesAsPrivileged([
  {
    scheme: "local-image",
    privileges: {
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
      bypassCSP: true,
    },
  },
  {
    scheme: "item-image",
    privileges: {
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
      bypassCSP: true,
    },
  },
]);

/**
 * @param {number | string} port
 */
function loadVite(port) {
  const mainWindow = getMainWindow();
  if (!mainWindow) return;
  mainWindow.loadURL(`http://localhost:${port}`).catch((e) => {
    log.warn("Error loading URL, retrying", e);
    setTimeout(() => {
      loadVite(port);
    }, 200);
  });
}

function createMainWindow() {
  log.log("Creating main window (dev =", dev, ")");
  const mainWindow = createWindow(dev);

  if (dev) loadVite(port);
  else void serveURL(mainWindow);
}

app.once("ready", async () => {
  log.log("App ready. Setting up handlers and protocols...");

  // カスタムプロトコルハンドラーを登録
  protocol.handle("local-image", async (request) => {
    // Strip query parameters and decode file path
    const urlWithoutProtocol = request.url.replace("local-image://", "");
    const urlWithoutQuery = urlWithoutProtocol.split("?")[0];
    let filePath;
    try {
      filePath = decodeURIComponent(urlWithoutQuery);
    } catch {
      log.error("Failed to decode local-image URI:", urlWithoutQuery);
      return new Response("Bad Request", { status: 400 });
    }

    // Security: only allow image file extensions to prevent arbitrary file reads
    const ext = path.extname(filePath).toLowerCase();
    if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
      log.warn("Forbidden local-image file extension:", ext, "Path:", filePath);
      return new Response("Forbidden", { status: 403 });
    }

    log.debug("Serving local-image:", filePath);
    try {
      const response = await net.fetch(pathToFileURL(filePath).toString());
      const newHeaders = new Headers(response.headers);
      newHeaders.set("Access-Control-Allow-Origin", "*");
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    } catch (e) {
      return new Response("Not Found", { status: 404 });
    }
  });

  // アイテム画像用カスタムプロトコルハンドラー
  protocol.handle("item-image", async (request) => {
    const { getStore } = await import("./store.js");
    const store = getStore();
    const itemImageFolderPath = store.get("itemImageFolderPath");

    if (!itemImageFolderPath) {
      log.warn("Item image folder not configured for item-image protocol");
      // Return 404 if no folder configured
      return new Response("Item image folder not configured", { status: 404 });
    }

    // URL format: item-image://path/to/item_suffix.webp
    const urlWithoutProtocol = request.url.replace("item-image://", "");
    const urlWithoutQuery = urlWithoutProtocol.split("?")[0];
    let relativePath;
    try {
      relativePath = decodeURIComponent(urlWithoutQuery);
    } catch {
      log.error("Failed to decode item-image URI:", urlWithoutQuery);
      return new Response("Bad Request", { status: 400 });
    }

    // Construct the full file path and normalize it
    const resolvedBase = path.resolve(itemImageFolderPath);
    const filePath = path.resolve(resolvedBase, relativePath);

    // Security: ensure the resolved path stays within the configured folder
    // Use path.relative() to detect traversal attempts — safe on all platforms
    const rel = path.relative(resolvedBase, filePath);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      log.warn("Forbidden item-image directory traversal attempt relative path:", rel);
      return new Response("Forbidden", { status: 403 });
    }

    // Security: only allow image file extensions
    const ext = path.extname(filePath).toLowerCase();
    if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
      log.warn("Forbidden item-image file extension:", ext, "Path:", filePath);
      return new Response("Forbidden", { status: 403 });
    }

    log.debug("Serving item-image:", filePath);
    return net.fetch(pathToFileURL(filePath).toString());
  });

  await initStore();

  log.log("Initializing handlers and services...");
  // Setup IPC Handlers
  setupFileHandlers();
  setupAipriHandlers();
  setupAppHandlers(getMainWindow);

  // Setup update service
  const store = getStore();
  const autoCheck = store.get("autoUpdateCheck") !== false;
  setupUpdateService(getMainWindow, { autoCheck });

  createMainWindow();
});

app.on("activate", () => {
  if (!getMainWindow()) {
    log.log("App activated. Re-creating main window...");
    createMainWindow();
  }
});

app.on("window-all-closed", () => {
  log.log("All windows closed. Quitting app...");
  if (process.platform !== "darwin") app.quit();
});

// Legacy test IPC
ipcMain.on("to-main", (event, count) => {
  const mainWindow = getMainWindow();
  if (!mainWindow) return;
  return mainWindow.webContents.send("from-main", `next count is ${count + 1}`);
});
