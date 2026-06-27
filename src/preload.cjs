const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Folder selection dialog
  selectFolder: () => ipcRenderer.invoke("select-folder"),

  // File selection dialog
  selectFile: (options) => ipcRenderer.invoke("select-file", options),

  // Get images from folder
  getImages: (folderPath) => ipcRenderer.invoke("get-images", folderPath),

  // Settings management
  getSettings: () => ipcRenderer.invoke("get-settings"),
  setSettings: (settings) => ipcRenderer.invoke("set-settings", settings),

  // Image metadata management
  getImageMetadata: (folderPath, imageName) =>
    ipcRenderer.invoke("get-image-metadata", folderPath, imageName),
  setImageMetadata: (folderPath, imageName, metadata) =>
    ipcRenderer.invoke("set-image-metadata", folderPath, imageName, metadata),

  // File explorer
  showItemInFolder: (filePath) => ipcRenderer.invoke("show-item-in-folder", filePath),

  // Copy image to clipboard
  copyImageToClipboard: (filePath) => ipcRenderer.invoke("copy-image-to-clipboard", filePath),

  // Friend card
  saveFriendCard: (folderPath, filename, base64Data) =>
    ipcRenderer.invoke("save-friend-card", folderPath, filename, base64Data),
  deleteFriendCard: (folderPath, filename) =>
    ipcRenderer.invoke("delete-friend-card", folderPath, filename),

  // Background removal
  getBackgroundMask: (imageData) => ipcRenderer.invoke("get-background-mask", imageData),
  saveFileDialog: (options) => ipcRenderer.invoke("save-file-dialog", options),
  saveTransparentImage: (filePath, base64Data) =>
    ipcRenderer.invoke("save-transparent-image", filePath, base64Data),

  // Aipri API
  aipriCheckSession: () => ipcRenderer.invoke("aipri-check-session"),
  aipriClearSession: () => ipcRenderer.invoke("aipri-clear-session"),
  aipriFetchPhotos: (targetYm) => ipcRenderer.invoke("aipri-fetch-photos", targetYm),
  aipriDownloadPhoto: (url, filename, folderPath) =>
    ipcRenderer.invoke("aipri-download-photo", url, filename, folderPath),

  // Multi-account API
  aipriGetAccounts: () => ipcRenderer.invoke("aipri-get-accounts"),
  aipriAddAccount: (credentials) => ipcRenderer.invoke("aipri-add-account", credentials),
  aipriRemoveAccount: (accountId) => ipcRenderer.invoke("aipri-remove-account", accountId),
  aipriUpdateAccount: (accountId, credentials) =>
    ipcRenderer.invoke("aipri-update-account", accountId, credentials),
  aipriSwitchAccount: (accountId) => ipcRenderer.invoke("aipri-switch-account", accountId),

  // Dialogs
  showConfirmDialog: (options) => ipcRenderer.invoke("show-confirm-dialog", options),

  // Window controls
  windowMinimize: () => ipcRenderer.send("window-minimize"),
  windowMaximize: () => ipcRenderer.send("window-maximize"),
  windowClose: () => ipcRenderer.send("window-close"),

  // Auto-updater API
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  checkForUpdates: () => ipcRenderer.invoke("update-check"),
  downloadUpdate: () => ipcRenderer.invoke("update-download"),
  quitAndInstall: () => ipcRenderer.invoke("update-install"),

  // Auto-updater events (main -> renderer)
  onUpdateChecking: (callback) => {
    ipcRenderer.on("update-checking", callback);
    return () => ipcRenderer.removeListener("update-checking", callback);
  },
  onUpdateAvailable: (callback) => {
    const handler = (_e, info) => callback(info);
    ipcRenderer.on("update-available", handler);
    return () => ipcRenderer.removeListener("update-available", handler);
  },
  onUpdateNotAvailable: (callback) => {
    ipcRenderer.on("update-not-available", callback);
    return () => ipcRenderer.removeListener("update-not-available", callback);
  },
  onDownloadProgress: (callback) => {
    const handler = (_e, progress) => callback(progress);
    ipcRenderer.on("update-download-progress", handler);
    return () => ipcRenderer.removeListener("update-download-progress", handler);
  },
  onUpdateDownloaded: (callback) => {
    const handler = (_e, info) => callback(info);
    ipcRenderer.on("update-downloaded", handler);
    return () => ipcRenderer.removeListener("update-downloaded", handler);
  },
  onUpdateError: (callback) => {
    const handler = (_e, message) => callback(message);
    ipcRenderer.on("update-error", handler);
    return () => ipcRenderer.removeListener("update-error", handler);
  },
});
