import { app, BrowserWindow, ipcMain, nativeTheme, dialog } from 'electron';
import * as path from 'path';
import * as keytar from 'keytar';
import { autoUpdater } from 'electron-updater';

const SERVICE_NAME = 'goranked-chat-desk';
const ACCOUNT_NAME = 'auth-token';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    backgroundColor: '#1a1a1a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: true,
    show: false,
  });

  // Load the app
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('isPackaged:', app.isPackaged);
  console.log('isDev:', isDev);

  if (isDev) {
    console.log('Loading from http://localhost:3000');
    mainWindow.loadURL('http://localhost:3000').catch((err) => {
      console.error('Error loading URL:', err);
    });
    // Open DevTools after a short delay to ensure page is loaded
    setTimeout(() => {
      mainWindow?.webContents.openDevTools();
    }, 1000);
  } else {
    const indexPath = path.join(__dirname, '../renderer/index.html');
    console.log('Loading from file:', indexPath);
    mainWindow.loadFile(indexPath).catch((err) => {
      console.error('Error loading file:', err);
    });
  }

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Failed to load:', errorCode, errorDescription, validatedURL);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Page finished loading');
  });

  mainWindow.webContents.on('dom-ready', () => {
    console.log('DOM ready');
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer ${level}]:`, message, `(${sourceId}:${line})`);
  });

  mainWindow.once('ready-to-show', () => {
    console.log('Window ready to show');
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Configure auto-updater
if (app.isPackaged) {
  // Use GitHub Releases for updates
  // Set UPDATE_URL environment variable to use custom server, otherwise uses GitHub
  const updateUrl = process.env.UPDATE_URL;
  
  if (updateUrl) {
    // Custom update server
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: updateUrl,
    });
  } else {
    // GitHub Releases (default)
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: process.env.GITHUB_OWNER || 'Revoool',
      repo: process.env.GITHUB_REPO || 'chat.goranked',
    });
  }

  // Check for updates on startup
  autoUpdater.checkForUpdatesAndNotify();
  
  // Check for updates every 4 hours
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 4 * 60 * 60 * 1000);

  // Auto-updater events
  autoUpdater.on('update-available', (info) => {
    console.log('🔄 Update available:', info.version);
    if (mainWindow) {
      mainWindow.webContents.send('update-available', info);
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('✅ Update downloaded:', info.version);
    
    // ПРИНУДИТЕЛЬНОЕ ОБНОВЛЕНИЕ (раскомментируйте для включения)
    // autoUpdater.quitAndInstall(false, true);
    // return;
    
    // ОБЫЧНОЕ ОБНОВЛЕНИЕ (с выбором пользователя)
    if (mainWindow) {
      const response = dialog.showMessageBoxSync(mainWindow, {
        type: 'info',
        title: 'Обновление готово',
        message: `Доступна новая версия ${info.version}. Перезапустить приложение сейчас?`,
        detail: 'Приложение будет перезапущено для установки обновления.',
        buttons: ['Перезапустить', 'Позже'],
        defaultId: 0,
        cancelId: 1,
      });
      
      if (response === 0) {
        autoUpdater.quitAndInstall(false, true);
      }
    }
  });

  autoUpdater.on('error', (error) => {
    console.error('❌ Auto-updater error:', error);
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers for secure token storage
ipcMain.handle('store-token', async (_event, token: string) => {
  try {
    if (!token || token.trim() === '') {
      throw new Error('Token is empty');
    }
    await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, token);
    return { success: true };
  } catch (error: any) {
    console.error('Error storing token:', error);
    // Keytar may fail on some systems, return error but don't crash
    return { 
      success: false, 
      error: error?.message || String(error),
      // Allow fallback to localStorage
      allowFallback: true
    };
  }
});

ipcMain.handle('get-token', async () => {
  try {
    const token = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
    return { success: true, token: token || null };
  } catch (error) {
    console.error('Error getting token:', error);
    return { success: false, error: String(error), token: null };
  }
});

ipcMain.handle('delete-token', async () => {
  try {
    await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
    return { success: true };
  } catch (error) {
    console.error('Error deleting token:', error);
    return { success: false, error: String(error) };
  }
});

