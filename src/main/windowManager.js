import { BrowserWindow } from 'electron';
import windowStateManager from 'electron-window-state';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM shim for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../'); // Assuming src/main/windowManager.js -> root is ../../

/** @type {BrowserWindow | null} */
let mainWindow = null;

export function getMainWindow() {
  return mainWindow;
}

/**
 * @param {boolean} isDev
 */
export function createWindow(isDev) {
  let windowState = windowStateManager({
    defaultWidth: 1280,
    defaultHeight: 720,
  });

  const newWindow = new BrowserWindow({
    backgroundColor: 'whitesmoke',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#120b18',
      symbolColor: '#ffffff',
      height: 32
    },
    title: 'VerseConnect',
    icon: path.join(PROJECT_ROOT, 'src/lib/assets/favicon.png'),
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
      devTools: isDev,
      preload: path.join(PROJECT_ROOT, 'src/preload.cjs'),
    },
    x: windowState.x,
    y: windowState.y,
    width: windowState.width,
    height: windowState.height,
    fullscreenable: false,
    fullscreen: false,
    frame: false,
  });

  mainWindow = newWindow;

  windowState.manage(newWindow);

  newWindow.once('ready-to-show', () => {
    newWindow.show();
    newWindow.focus();
  });

  newWindow.on('close', () => {
    windowState.saveState(newWindow);
  });

  newWindow.once('closed', () => {
    mainWindow = null;
  });

  return newWindow;
}
