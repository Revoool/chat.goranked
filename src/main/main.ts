import { app, BrowserWindow, ipcMain, nativeTheme, dialog, Menu, globalShortcut } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as keytar from 'keytar';
import { autoUpdater } from 'electron-updater';

const SERVICE_NAME = 'goranked-chat-desk';
const ACCOUNT_NAME = 'auth-token';

let mainWindow: BrowserWindow | null = null;

function createMenu() {
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Developer Tools',
          accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.toggleDevTools();
            }
          },
        },
        { type: 'separator' },
        { role: 'reload', label: 'Reload' },
        { role: 'forceReload', label: 'Force Reload' },
        { role: 'toggleDevTools', label: 'Toggle DevTools (F12)' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Actual Size' },
        { role: 'zoomIn', label: 'Zoom In' },
        { role: 'zoomOut', label: 'Zoom Out' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Toggle Full Screen' },
      ],
    },
  ];

  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about', label: 'About ' + app.getName() },
        { type: 'separator' },
        { role: 'services', label: 'Services' },
        { type: 'separator' },
        { role: 'hide', label: 'Hide ' + app.getName() },
        { role: 'hideOthers', label: 'Hide Others' },
        { role: 'unhide', label: 'Show All' },
        { type: 'separator' },
        { role: 'quit', label: 'Quit ' + app.getName() },
      ],
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

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

  let indexPath = path.join(__dirname, 'index.html');

  if (isDev) {
    // Try to load from dev server first
    console.log('Attempting to load from http://localhost:3000');
    mainWindow.loadURL('http://localhost:3000').catch((err) => {
      console.error('Error loading from dev server:', err);
      console.log('Falling back to local file:', indexPath);
      // Fallback to local file if dev server is not available
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadFile(indexPath).catch((err2: any) => {
          console.error('Failed to load index.html:', err2);
          // Try loading with URL protocol
          if (mainWindow && !mainWindow.isDestroyed()) {
            const fileUrl = `file://${indexPath.replace(/\\/g, '/')}`;
            mainWindow.loadURL(fileUrl).catch((err3: any) => {
              console.error('Failed to load with URL:', err3);
            });
          }
        });
      }
    });
    // Open DevTools after a short delay to ensure page is loaded
    setTimeout(() => {
      mainWindow?.webContents.openDevTools();
    }, 1000);
  } else {
    // In production, files are packaged in app.asar
    // index.html is in the same directory as main.js (both in dist/)
    console.log('Production mode - loading from:', indexPath);
    console.log('__dirname:', __dirname);
    console.log('app.getAppPath():', app.getAppPath());
    
    // Check if file exists
    if (fs.existsSync(indexPath)) {
      console.log('✓ index.html exists at:', indexPath);
    } else {
      console.error('✗ index.html NOT found at:', indexPath);
      // Try alternative paths
      const altPaths = [
        path.join(app.getAppPath(), 'index.html'),
        path.join(app.getAppPath(), 'dist', 'index.html'),
        path.join(__dirname, '..', 'index.html'),
      ];
      for (const altPath of altPaths) {
        if (fs.existsSync(altPath)) {
          console.log('Found index.html at alternative path:', altPath);
          indexPath = altPath;
          break;
        }
      }
    }
    
    if (mainWindow) {
      mainWindow.loadFile(indexPath).catch((err: any) => {
        console.error('Failed to load index.html:', err);
        console.error('Error details:', JSON.stringify(err, null, 2));
        // Try loading with URL protocol
        if (mainWindow && !mainWindow.isDestroyed()) {
          const fileUrl = `file://${indexPath.replace(/\\/g, '/')}`;
          console.log('Trying to load with file:// URL:', fileUrl);
          mainWindow.loadURL(fileUrl).catch((err2: any) => {
            console.error('Failed to load with URL:', err2);
            // Show error to user
            dialog.showErrorBox(
              'Критическая ошибка',
              `Не удалось загрузить приложение.\n\nПроверьте консоль для подробностей.\n\nНажмите F12 или Ctrl+Shift+I для открытия DevTools.`
            );
          });
        }
      });
    }
  }

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Failed to load:', errorCode, errorDescription, validatedURL);
    console.error('Attempted URL:', validatedURL);
    console.error('Index path:', indexPath);
    console.error('__dirname:', __dirname);
    
    // Show error dialog in production
    if (app.isPackaged && mainWindow && !mainWindow.isDestroyed()) {
      dialog.showErrorBox(
        'Ошибка загрузки',
        `Не удалось загрузить приложение.\n\nКод ошибки: ${errorCode}\nОписание: ${errorDescription}\n\nПопробуйте перезапустить приложение.`
      );
      mainWindow.show();
    } else if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
    }
  });

  mainWindow.webContents.on('unresponsive', () => {
    console.warn('Window became unresponsive');
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('Renderer process gone:', details);
    // Recreate window if crashed
    if (details.reason === 'crashed') {
      setTimeout(() => {
        if (BrowserWindow.getAllWindows().length === 0) {
          createWindow();
        }
      }, 1000);
    }
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

  // Register global shortcuts for DevTools
  globalShortcut.register('F12', () => {
    if (mainWindow) {
      mainWindow.webContents.toggleDevTools();
    }
  });

  globalShortcut.register('CommandOrControl+Shift+I', () => {
    if (mainWindow) {
      mainWindow.webContents.toggleDevTools();
    }
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

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit, keep app running
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit, keep app running
});

app.whenReady().then(() => {
  createMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('will-quit', () => {
  // Unregister all shortcuts
  globalShortcut.unregisterAll();
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

// IPC handler for checking updates manually
ipcMain.handle('check-for-updates', async () => {
  if (!app.isPackaged) {
    return { success: false, message: 'Updates are only available in production builds' };
  }
  
  try {
    console.log('🔄 Manual update check requested');
    const result = await autoUpdater.checkForUpdates();
    return { 
      success: true, 
      message: 'Проверка обновлений запущена',
      updateInfo: result?.updateInfo || null
    };
  } catch (error: any) {
    console.error('❌ Error checking for updates:', error);
    return { 
      success: false, 
      error: error?.message || String(error),
      message: 'Ошибка при проверке обновлений'
    };
  }
});

// IPC handler for getting app version
ipcMain.handle('get-app-version', async () => {
  return { version: app.getVersion() };
});

