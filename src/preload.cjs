const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Folder selection dialog
  selectFolder: () => ipcRenderer.invoke('select-folder'),

  // Get images from folder
  getImages: (folderPath) => ipcRenderer.invoke('get-images', folderPath),

  // Settings management
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSettings: (settings) => ipcRenderer.invoke('set-settings', settings),

  // Image metadata management
  getImageMetadata: (folderPath, imageName) => ipcRenderer.invoke('get-image-metadata', folderPath, imageName),
  setImageMetadata: (folderPath, imageName, metadata) => ipcRenderer.invoke('set-image-metadata', folderPath, imageName, metadata),

  // ZIP extraction
  extractZip: (zipPath, targetFolder) => ipcRenderer.invoke('extract-zip', zipPath, targetFolder),

  // File explorer
  showItemInFolder: (filePath) => ipcRenderer.invoke('show-item-in-folder', filePath),

  // Friend card
  saveFriendCard: (folderPath, filename, base64Data) => ipcRenderer.invoke('save-friend-card', folderPath, filename, base64Data),

  // Aipri API
  aipriLogin: (credentials) => ipcRenderer.invoke('aipri-login', credentials),
  aipriCheckSession: () => ipcRenderer.invoke('aipri-check-session'),
  aipriClearSession: () => ipcRenderer.invoke('aipri-clear-session'),
  aipriFetchPhotos: (targetYm) => ipcRenderer.invoke('aipri-fetch-photos', targetYm),
  aipriDownloadPhoto: (url, filename, folderPath) => ipcRenderer.invoke('aipri-download-photo', url, filename, folderPath),

  // Multi-account API
  aipriGetAccounts: () => ipcRenderer.invoke('aipri-get-accounts'),
  aipriAddAccount: (credentials) => ipcRenderer.invoke('aipri-add-account', credentials),
  aipriRemoveAccount: (name) => ipcRenderer.invoke('aipri-remove-account', name),
  aipriUpdateAccount: (oldName, credentials) => ipcRenderer.invoke('aipri-update-account', oldName, credentials),
  aipriSwitchAccount: (name) => ipcRenderer.invoke('aipri-switch-account', name),

  // Dialogs
  showConfirmDialog: (options) => ipcRenderer.invoke('show-confirm-dialog', options),

  // Window controls
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),
});
