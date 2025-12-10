const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  loadLeases: () => ipcRenderer.invoke('load-leases'),
  saveLeases: (leases) => ipcRenderer.invoke('save-leases', leases),
});
