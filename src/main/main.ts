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
    // In production, electron-builder packages files in app.asar
    // __dirname points to the directory inside app.asar where main.js is located
    // index.html is in the same directory as main.js (both in dist/)
    // When packaged, both are inside app.asar at the same level
    let indexPath = path.join(__dirname, 'index.html');
    console.log('=== Production Load Debug ===');
    console.log('__dirname:', __dirname);
    console.log('app.getAppPath():', app.getAppPath());
    console.log('app.isPackaged:', app.isPackaged);
    console.log('Initial indexPath:', indexPath);
    
    const fs = require('fs');
    let pathExists = fs.existsSync(indexPath);
    console.log('indexPath exists:', pathExists);
    
    if (!pathExists) {
      // Try alternative paths
      const alternatives = [
        path.join(__dirname, '../index.html'),
        path.join(app.getAppPath(), 'index.html'),
        path.join(app.getAppPath(), 'dist', 'index.html'),
      ];
      
      for (const altPath of alternatives) {
        const exists = fs.existsSync(altPath);
        console.log('Trying alternative:', altPath, 'exists:', exists);
        if (exists) {
          indexPath = altPath;
          pathExists = true;
          break;
        }
      }
    }
    
    if (mainWindow) {
      console.log('Final indexPath:', indexPath);
      mainWindow.loadFile(indexPath).catch((err: any) => {
        console.error('❌ Failed to load file:', err);
        console.error('Error code:', err.code);
        console.error('Error message:', err.message);
        // Show error to user
        if (mainWindow) {
          mainWindow.webContents.executeJavaScript(`
            document.body.innerHTML = '<div style="padding: 20px; color: white; font-family: system-ui;">
              <h2>Ошибка загрузки приложения</h2>
              <p>Не удалось загрузить index.html</p>
              <p>Проверьте логи в Console.app</p>
            </div>';
          `).catch(() => {});
        }
      });
    }
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
  
  // Check for updates every 30 minutes (чаще проверяем обновления)
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 30 * 60 * 1000);
  
  // Также проверяем при активации окна (когда пользователь возвращается к приложению)
  app.on('activate', () => {
    autoUpdater.checkForUpdatesAndNotify();
  });

  // Auto-updater events
  autoUpdater.on('update-available', (info) => {
    console.log('🔄 Update available:', info.version);
    if (mainWindow) {
      mainWindow.webContents.send('update-available', info);
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('✅ Update downloaded:', info.version);
    
    // Автоматически устанавливаем обновление через 5 секунд
    // Пользователь может отменить, нажав "Отмена"
    if (mainWindow && !mainWindow.isDestroyed()) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Обновление готово',
        message: `Доступна новая версия ${info.version}`,
        detail: 'Приложение будет перезапущено через 5 секунд для установки обновления. Нажмите "Отмена" чтобы отложить.',
        buttons: ['Перезапустить сейчас', 'Отмена'],
        defaultId: 0,
        cancelId: 1,
      }).then((response) => {
        if (response.response === 0) {
          // Перезапустить сразу
          autoUpdater.quitAndInstall(false, true);
        } else {
          // Автоматически установить через 5 секунд
          setTimeout(() => {
            console.log('🔄 Auto-installing update after 5 seconds');
            if (mainWindow && !mainWindow.isDestroyed()) {
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Установка обновления',
                message: 'Приложение будет перезапущено сейчас.',
                buttons: ['OK'],
              }).then(() => {
                autoUpdater.quitAndInstall(false, true);
              });
            } else {
              autoUpdater.quitAndInstall(false, true);
            }
          }, 5000);
        }
      });
    } else {
      // Если окно закрыто, установить через 5 секунд
      setTimeout(() => {
        console.log('🔄 Auto-installing update (window closed)');
        autoUpdater.quitAndInstall(false, true);
      }, 5000);
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

