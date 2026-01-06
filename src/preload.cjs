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
});
