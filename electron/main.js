const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

// Get the settings file path (always in default userData, not custom path)
const getSettingsPath = () => {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'settings.json');
};

// Load settings from file
const loadSettings = () => {
  try {
    const settingsPath = getSettingsPath();
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
  return { dataFilePath: null };
};

// Save settings to file
const saveSettings = (settings) => {
  try {
    const settingsPath = getSettingsPath();
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Error saving settings:', error);
    return false;
  }
};

// Get the base data directory (uses custom path if set)
const getDataDir = () => {
  const settings = loadSettings();

  let dataDir;
  if (settings.dataFilePath) {
    dataDir = settings.dataFilePath;
  } else {
    const userDataPath = app.getPath('userData');
    dataDir = path.join(userDataPath, 'data');
  }

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  return dataDir;
};

// Get the entities directory
const getEntitiesDir = () => {
  const entitiesDir = path.join(getDataDir(), 'entities');

  if (!fs.existsSync(entitiesDir)) {
    fs.mkdirSync(entitiesDir, { recursive: true });
  }

  return entitiesDir;
};

// Get entity directory by ID
const getEntityDir = (entityId) => {
  return path.join(getEntitiesDir(), entityId);
};

// Get app state file path
const getAppStatePath = () => {
  return path.join(getDataDir(), 'app-state.json');
};

// Legacy: Get the user data path for storing app data (keeping for backwards compatibility)
const getDataPath = () => {
  return path.join(getDataDir(), 'leases.json');
};

// IPC handlers for file operations
ipcMain.handle('load-leases', async () => {
  try {
    const dataPath = getDataPath();
    if (fs.existsSync(dataPath)) {
      const data = fs.readFileSync(dataPath, 'utf-8');
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    console.error('Error loading leases:', error);
    return [];
  }
});

ipcMain.handle('save-leases', async (event, leases) => {
  try {
    const dataPath = getDataPath();
    fs.writeFileSync(dataPath, JSON.stringify(leases, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Error saving leases:', error);
    return false;
  }
});

// Entity IPC handlers
ipcMain.handle('load-entities', async () => {
  try {
    const entitiesDir = getEntitiesDir();
    const entities = [];

    if (fs.existsSync(entitiesDir)) {
      const entityDirs = fs.readdirSync(entitiesDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      for (const entityId of entityDirs) {
        const configPath = path.join(entitiesDir, entityId, 'config.json');
        if (fs.existsSync(configPath)) {
          const configData = fs.readFileSync(configPath, 'utf-8');
          entities.push(JSON.parse(configData));
        }
      }
    }

    return entities;
  } catch (error) {
    console.error('Error loading entities:', error);
    return [];
  }
});

ipcMain.handle('save-entity', async (event, entity) => {
  try {
    const entityDir = getEntityDir(entity.id);

    if (!fs.existsSync(entityDir)) {
      fs.mkdirSync(entityDir, { recursive: true });
    }

    const configPath = path.join(entityDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(entity, null, 2), 'utf-8');

    // Initialize empty leases file if it doesn't exist
    const leasesPath = path.join(entityDir, 'leases.json');
    if (!fs.existsSync(leasesPath)) {
      fs.writeFileSync(leasesPath, JSON.stringify([], null, 2), 'utf-8');
    }

    return true;
  } catch (error) {
    console.error('Error saving entity:', error);
    return false;
  }
});

ipcMain.handle('delete-entity', async (event, entityId) => {
  try {
    const entityDir = getEntityDir(entityId);

    if (fs.existsSync(entityDir)) {
      fs.rmSync(entityDir, { recursive: true, force: true });
    }

    return true;
  } catch (error) {
    console.error('Error deleting entity:', error);
    return false;
  }
});

ipcMain.handle('load-entity-leases', async (event, entityId) => {
  try {
    const leasesPath = path.join(getEntityDir(entityId), 'leases.json');

    if (fs.existsSync(leasesPath)) {
      const data = fs.readFileSync(leasesPath, 'utf-8');
      return JSON.parse(data);
    }

    return [];
  } catch (error) {
    console.error('Error loading entity leases:', error);
    return [];
  }
});

ipcMain.handle('save-entity-leases', async (event, entityId, leases) => {
  try {
    const entityDir = getEntityDir(entityId);

    if (!fs.existsSync(entityDir)) {
      fs.mkdirSync(entityDir, { recursive: true });
    }

    const leasesPath = path.join(entityDir, 'leases.json');
    fs.writeFileSync(leasesPath, JSON.stringify(leases, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Error saving entity leases:', error);
    return false;
  }
});

// App state IPC handlers
ipcMain.handle('load-app-state', async () => {
  try {
    const statePath = getAppStatePath();

    if (fs.existsSync(statePath)) {
      const data = fs.readFileSync(statePath, 'utf-8');
      return JSON.parse(data);
    }

    return { selectedEntityId: null };
  } catch (error) {
    console.error('Error loading app state:', error);
    return { selectedEntityId: null };
  }
});

ipcMain.handle('save-app-state', async (event, appState) => {
  try {
    const statePath = getAppStatePath();
    fs.writeFileSync(statePath, JSON.stringify(appState, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Error saving app state:', error);
    return false;
  }
});

// Dialog IPC handler
ipcMain.handle('show-open-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Data Folder',
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

// Settings IPC handlers
ipcMain.handle('get-data-path', async () => {
  const settings = loadSettings();
  if (settings.dataFilePath) {
    return settings.dataFilePath;
  }
  // Return the default path if no custom path is set
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'data');
});

ipcMain.handle('set-data-path', async (event, dataPath) => {
  const settings = loadSettings();
  settings.dataFilePath = dataPath;
  return saveSettings(settings);
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, '../public/logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load the app
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
