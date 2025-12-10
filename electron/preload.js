const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Legacy lease operations (kept for backwards compatibility)
  loadLeases: () => ipcRenderer.invoke('load-leases'),
  saveLeases: (leases) => ipcRenderer.invoke('save-leases', leases),

  // Entity operations
  loadEntities: () => ipcRenderer.invoke('load-entities'),
  saveEntity: (entity) => ipcRenderer.invoke('save-entity', entity),
  deleteEntity: (entityId) => ipcRenderer.invoke('delete-entity', entityId),

  // Entity-specific lease operations
  loadEntityLeases: (entityId) => ipcRenderer.invoke('load-entity-leases', entityId),
  saveEntityLeases: (entityId, leases) => ipcRenderer.invoke('save-entity-leases', entityId, leases),

  // App state operations
  loadAppState: () => ipcRenderer.invoke('load-app-state'),
  saveAppState: (appState) => ipcRenderer.invoke('save-app-state', appState),
});
