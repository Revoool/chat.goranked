import { app, BrowserWindow, ipcMain, nativeTheme, dialog, Menu, globalShortcut, Tray, shell, safeStorage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater';
import * as https from 'https';

const TOKEN_FILE = 'auth-token.enc';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuiting = false;

function createMenu() {
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  
  // Для Windows скрываем меню полностью
  if (process.platform === 'win32') {
    Menu.setApplicationMenu(null);
    return;
  }
  
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Edit',
      submenu: [
        { role: 'undo', label: 'Undo' },
        { role: 'redo', label: 'Redo' },
        { type: 'separator' },
        { role: 'cut', label: 'Cut' },
        { role: 'copy', label: 'Copy' },
        { role: 'paste', label: 'Paste' },
        { role: 'pasteAndMatchStyle', label: 'Paste and Match Style' },
        { role: 'delete', label: 'Delete' },
        { role: 'selectAll', label: 'Select All' },
      ],
    },
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
        { 
          role: 'quit', 
          label: 'Quit ' + app.getName(),
          click: () => {
            isQuiting = true;
            app.quit();
          }
        },
      ],
    });
  } else {
    // Для Linux добавляем меню File с опцией Quit
    template.unshift({
      label: 'File',
      submenu: [
        {
          label: 'Exit',
          accelerator: 'Ctrl+Q',
          click: () => {
            isQuiting = true;
            app.quit();
          },
        },
      ],
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createTray() {
  let iconPath: string;
  
  // Для macOS используем меньшую иконку для menu bar (32x32)
  // Для других платформ можно использовать большую иконку
  const iconFileName = process.platform === 'darwin' ? 'tray-icon.png' : 'icon.png';
  
  if (app.isPackaged) {
    // В собранном приложении иконка в extraResources
    iconPath = path.join(process.resourcesPath, iconFileName);
  } else {
    // В режиме разработки
    iconPath = path.join(__dirname, '..', '..', 'build', iconFileName);
  }

  // Если иконка не найдена, логируем предупреждение и пробуем альтернативные пути
  if (!fs.existsSync(iconPath)) {
    console.warn('Tray icon not found at:', iconPath, 'Trying alternative paths...');
    // Пробуем альтернативные пути
    const altPaths = [
      path.join(process.resourcesPath, 'build', iconFileName),
      path.join(app.getAppPath(), 'build', iconFileName),
      path.join(__dirname, '..', 'build', iconFileName),
      path.join(__dirname, '..', '..', 'build', iconFileName),
      // Fallback на обычную иконку если tray-icon не найден
      path.join(process.resourcesPath, 'icon.png'),
      path.join(__dirname, '..', '..', 'build', 'icon.png'),
    ];
    const foundPath = altPaths.find(p => fs.existsSync(p));
    if (foundPath) {
      iconPath = foundPath;
      console.log('Found tray icon at:', iconPath);
    } else {
      console.error('Could not find tray icon, using default');
    }
  }

  tray = new Tray(iconPath);
  
  // Для macOS устанавливаем размер иконки (menu bar требует 22x22 или меньше)
  if (process.platform === 'darwin') {
    tray.setImage(iconPath); // Убеждаемся что используется правильная иконка
  }
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Показать',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      },
    },
    {
      label: 'Скрыть',
      click: () => {
        if (mainWindow) {
          mainWindow.hide();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Выход',
      click: () => {
        isQuiting = true;
        app.quit();
      },
    },
  ]);
  
  tray.setToolTip('Goranked Chat Desk');
  tray.setContextMenu(contextMenu);
  
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    } else {
      createWindow();
    }
  });
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
    ...(process.platform === 'darwin'
      ? { trafficLightPosition: { x: 14, y: 12 } }
      : {}),
    frame: true,
    show: false,
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('isPackaged:', app.isPackaged);
  console.log('isDev:', isDev);

  let indexPath = path.join(__dirname, 'index.html');

  if (isDev) {
    console.log('Attempting to load from http://localhost:3000');
    mainWindow.loadURL('http://localhost:3000').catch((err) => {
      console.error('Error loading from dev server:', err);
      console.log('Falling back to local file:', indexPath);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadFile(indexPath).catch((err2: any) => {
          console.error('Failed to load index.html:', err2);
          if (mainWindow && !mainWindow.isDestroyed()) {
            const fileUrl = `file://${indexPath.replace(/\\/g, '/')}`;
            mainWindow.loadURL(fileUrl).catch((err3: any) => {
              console.error('Failed to load with URL:', err3);
            });
          }
        });
      }
    });
    setTimeout(() => {
      mainWindow?.webContents.openDevTools();
    }, 1000);
  } else {
    console.log('Production mode - loading from:', indexPath);
    console.log('__dirname:', __dirname);
    console.log('app.getAppPath():', app.getAppPath());
    
    if (fs.existsSync(indexPath)) {
      console.log('✓ index.html exists at:', indexPath);
    } else {
      console.error('✗ index.html NOT found at:', indexPath);
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
        if (mainWindow && !mainWindow.isDestroyed()) {
          const fileUrl = `file://${indexPath.replace(/\\/g, '/')}`;
          console.log('Trying to load with file:// URL:', fileUrl);
          mainWindow.loadURL(fileUrl).catch((err2: any) => {
            console.error('Failed to load with URL:', err2);
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

  mainWindow.on('close', (event) => {
    if (!isQuiting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

if (app.isPackaged) {
  const updateUrl = process.env.UPDATE_URL;
  const githubOwner = process.env.GITHUB_OWNER || 'Revoool';
  const githubRepo = process.env.GITHUB_REPO || 'chat.goranked';
  
  console.log('🔧 Configuring auto-updater...');
  console.log('  - Owner:', githubOwner);
  console.log('  - Repo:', githubRepo);
  console.log('  - Current version:', app.getVersion());
  
  if (updateUrl) {
    console.log('  - Using custom update URL:', updateUrl);
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: updateUrl,
    });
  } else {
    console.log('  - Using GitHub Releases');
    console.log('  - Repository is public');
    
    const feedURLConfig: any = {
      provider: 'github',
      owner: githubOwner,
      repo: githubRepo,
      private: false,
    };
    
    console.log('  - Using public repository (releases are public)');
    
    console.log('  - Feed URL config:', JSON.stringify(feedURLConfig, null, 2));
    autoUpdater.setFeedURL(feedURLConfig);
    
    const actualFeedURL = autoUpdater.getFeedURL();
    console.log('  - Actual feed URL:', actualFeedURL);
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  
  autoUpdater.on('download-progress', (progressObj: ProgressInfo) => {
    console.log('📥 Download progress:', {
      percent: progressObj.percent,
      transferred: progressObj.transferred,
      total: progressObj.total,
    });
    if (mainWindow) {
      mainWindow.webContents.send('update-download-progress', progressObj);
    }
  });
  
  console.log('🔄 Checking for updates on startup...');
  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    console.error('❌ Error checking for updates on startup:', err);
  });
  
  setInterval(() => {
    console.log('🔄 Periodic update check...');
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      console.error('❌ Error in periodic update check:', err);
    });
  }, 30 * 60 * 1000);
  
  app.on('activate', () => {
    console.log('🔄 Checking for updates on app activate...');
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      console.error('❌ Error checking for updates on activate:', err);
    });
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    console.log('🔄 Update available:', info.version);
    if (mainWindow) {
      mainWindow.webContents.send('update-available', info);
    }
  });

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    console.log('✅ Update downloaded:', info.version);
    console.log('✅ Update info:', JSON.stringify(info, null, 2));
    
    // Send update-downloaded event to renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-downloaded', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes,
        path: info.path,
      });
    }
    
    // Show dialog with option to install now or later
    if (mainWindow && !mainWindow.isDestroyed()) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Оновлення завантажено',
        message: `Оновлення версії ${info.version} готове до встановлення`,
        detail: 'Додаток буде перезапущено для встановлення оновлення. Ви можете встановити зараз або пізніше.',
        buttons: ['Встановити зараз', 'Пізніше'],
        defaultId: 0,
        cancelId: 1,
      }).then((response) => {
        if (response.response === 0) {
          // Install immediately
          console.log('🔄 Installing update immediately');
          autoUpdater.quitAndInstall(false, true);
        } else {
          // User chose to install later - will install on next app quit
          console.log('⏸️ User chose to install later. Update will be installed on next app quit.');
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('update-downloaded-deferred', {
              version: info.version,
              message: 'Оновлення буде встановлено при наступному закритті додатку',
            });
          }
        }
      }).catch((error) => {
        console.error('❌ Error showing update dialog:', error);
        // Fallback: install on next quit
        console.log('🔄 Will install update on next app quit');
      });
    } else {
      // Window is closed - install on next quit
      console.log('🔄 Window closed, update will be installed on next app quit');
    }
  });

  autoUpdater.on('error', (error: Error) => {
    console.error('❌ Auto-updater error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    if (mainWindow) {
      mainWindow.webContents.send('update-error', {
        message: error.message || 'Unknown error',
        error: String(error),
      });
    }
  });

  autoUpdater.on('checking-for-update', () => {
    console.log('🔍 Checking for update...');
  });

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    console.log('✅ No updates available. Current version:', app.getVersion());
    if (mainWindow) {
      mainWindow.webContents.send('update-not-available', {
        version: app.getVersion(),
        message: 'Встановлена остання версія',
      });
    }
  });
}

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

app.whenReady().then(() => {
  createMenu();
  createTray();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  // Не закрываем приложение при закрытии всех окон - сворачиваем в трей
  // Приложение будет закрыто только через меню трея или через Quit в меню приложения
});

// Secure token storage using Electron safeStorage (no native modules, works cross-platform)
function getTokenPath(): string {
  return path.join(app.getPath('userData'), TOKEN_FILE);
}

ipcMain.handle('store-token', async (_event, token: string) => {
  try {
    if (!token || token.trim() === '') {
      throw new Error('Token is empty');
    }
    if (app.isPackaged && safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(token);
      fs.writeFileSync(getTokenPath(), encrypted);
    } else {
      fs.writeFileSync(getTokenPath(), token, 'utf8');
    }
    return { success: true };
  } catch (error: any) {
    console.error('Error storing token:', error);
    return { success: false, error: error?.message || String(error), allowFallback: true };
  }
});

ipcMain.handle('get-token', async () => {
  try {
    const tokenPath = getTokenPath();
    if (!fs.existsSync(tokenPath)) return { success: true, token: null };
    const data = fs.readFileSync(tokenPath);
    if (app.isPackaged && safeStorage.isEncryptionAvailable()) {
      const token = safeStorage.decryptString(data);
      return { success: true, token };
    }
    return { success: true, token: data.toString('utf8') };
  } catch (error) {
    console.error('Error getting token:', error);
    return { success: false, error: String(error), token: null };
  }
});

ipcMain.handle('delete-token', async () => {
  try {
    const tokenPath = getTokenPath();
    if (fs.existsSync(tokenPath)) fs.unlinkSync(tokenPath);
    return { success: true };
  } catch (error) {
    console.error('Error deleting token:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('check-for-updates', async () => {
  if (!app.isPackaged) {
    return { 
      success: false, 
      message: 'Updates are only available in production builds',
      error: 'Development mode'
    };
  }
  
  try {
    console.log('🔄 Manual update check requested');
    console.log('  - Current version:', app.getVersion());
    
    const wasAutoDownload = autoUpdater.autoDownload;
    autoUpdater.autoDownload = false;
    
    try {
      const result = await autoUpdater.checkForUpdates();
      console.log('  - Check result:', result);
      
      autoUpdater.autoDownload = wasAutoDownload;
      
      if (result && result.updateInfo) {
        console.log('  - Update available:', result.updateInfo.version);
        
        let changelog = '';
        try {
          const updateUrl = process.env.UPDATE_URL;
          const version = result.updateInfo.version;

          if (updateUrl) {
            // Custom update server: fetch from releases.json
            const releasesUrl = `${updateUrl.replace(/\/$/, '')}/releases.json`;
            const releaseData = await new Promise<any>((resolve, reject) => {
              https.get(releasesUrl, {
                headers: { 'User-Agent': 'Goranked-Chat-Desk' },
              }, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                  if (res.statusCode === 200) {
                    try {
                      const arr = JSON.parse(data);
                      const release = Array.isArray(arr)
                        ? arr.find((r: any) => r.version === version || r.version === `v${version}`)
                        : null;
                      resolve(release || {});
                    } catch (e) {
                      reject(e);
                    }
                  } else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                  }
                });
              }).on('error', reject);
            });
            changelog = releaseData?.changelog || releaseData?.body || '';
          } else {
            // GitHub fallback (legacy)
            const githubOwner = process.env.GITHUB_OWNER || 'Revoool';
            const githubRepo = process.env.GITHUB_REPO || 'chat.goranked';
            const tag = `v${version}`;
            const url = `https://api.github.com/repos/${githubOwner}/${githubRepo}/releases/tags/${tag}`;
            const releaseData = await new Promise<any>((resolve, reject) => {
              https.get(url, {
                headers: {
                  'User-Agent': 'Goranked-Chat-Desk',
                  'Accept': 'application/vnd.github.v3+json',
                },
              }, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                  if (res.statusCode === 200) {
                    try {
                      resolve(JSON.parse(data));
                    } catch (e) {
                      reject(e);
                    }
                  } else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                  }
                });
              }).on('error', reject);
            });
            changelog = releaseData.body || releaseData.name || '';
          }
        } catch (err) {
          console.log('  - Could not fetch changelog:', err);
        }
        
        return { 
          success: true, 
          message: `Доступна нова версія: ${result.updateInfo.version}`,
          updateInfo: {
            ...result.updateInfo,
            changelog,
          },
          currentVersion: app.getVersion(),
        };
      }
      
      return { 
        success: true, 
        message: 'Ви використовуєте останню версію',
        updateInfo: null,
        currentVersion: app.getVersion(),
      };
    } catch (checkError: any) {
      autoUpdater.autoDownload = wasAutoDownload;
      throw checkError;
    }
  } catch (error: any) {
    console.error('❌ Error checking for updates:', error);
    
    let errorMessage = 'Помилка при перевірці оновлень';
    if (error?.message) {
      const errorStr = String(error.message).toLowerCase();
      if (errorStr.includes('404') || errorStr.includes('not found')) {
        errorMessage = 'Релиз не знайдено. Можливо, релиз ще створюється. Спробуйте пізніше.';
      } else if (errorStr.includes('403') || errorStr.includes('forbidden')) {
        errorMessage = 'Доступ заборонено. Перевірте налаштування репозиторію.';
      } else if (errorStr.includes('network') || errorStr.includes('enotfound')) {
        errorMessage = 'Помилка мережі. Перевірте підключення до інтернету.';
      } else if (errorStr.includes('timeout')) {
        errorMessage = 'Перевищено час очікування. Перевірте підключення до інтернету.';
      } else {
        errorMessage = `Помилка: ${error.message}`;
      }
    }
    
    return { 
      success: false, 
      error: error?.message || String(error),
      message: errorMessage,
      currentVersion: app.getVersion(),
    };
  }
});

ipcMain.handle('download-update', async () => {
  if (!app.isPackaged) {
    return { success: false, error: 'Updates are only available in production builds' };
  }
  
  try {
    console.log('📥 Starting update download...');
    autoUpdater.autoDownload = true;
    const result = await autoUpdater.checkForUpdates();
    
    if (result && result.updateInfo) {
      console.log('  - Download started for version:', result.updateInfo.version);
      return { 
        success: true, 
        message: 'Завантаження оновлення розпочато',
        updateInfo: result.updateInfo,
      };
    }
    
    return { 
      success: false, 
      error: 'Не вдалося розпочати завантаження',
    };
  } catch (error: any) {
    console.error('❌ Error starting download:', error);
    return { 
      success: false, 
      error: error?.message || String(error),
    };
  }
});

ipcMain.handle('get-app-version', async () => {
  return { version: app.getVersion() };
});

ipcMain.handle('get-sound-path', async () => {
  try {
    const soundFileName = 'best-notification-1-286672.mp3';
    
    if (app.isPackaged) { 
      const soundPath = path.join(process.resourcesPath, 'sound', soundFileName);
      
      if (fs.existsSync(soundPath)) {
        const fileUrl = `file://${soundPath.replace(/\\/g, '/')}`;
        return { success: true, path: fileUrl };
      } else {
        console.warn('Sound file not found at:', soundPath);
        const altPaths = [
          path.join(app.getAppPath(), 'sound', soundFileName),
          path.join(__dirname, '..', 'sound', soundFileName),
          path.join(process.resourcesPath, '..', 'sound', soundFileName),
        ];
        
        for (const altPath of altPaths) {
          if (fs.existsSync(altPath)) {
            const fileUrl = `file://${altPath.replace(/\\/g, '/')}`;
            return { success: true, path: fileUrl };
          }
        }
        
        return { success: false, error: 'Sound file not found' };
      }
    } else {
      const soundPath = path.join(__dirname, '..', 'dist', 'sound', soundFileName);
      if (fs.existsSync(soundPath)) {
        const fileUrl = `file://${soundPath.replace(/\\/g, '/')}`;
        return { success: true, path: fileUrl };
      }
      return { success: true, path: '/sound/best-notification-1-286672.mp3' };
    }
  } catch (error: any) {
    console.error('Error getting sound path:', error);
    return { success: false, error: error?.message || String(error) };
  }
});

ipcMain.handle('open-external', async (_event, url: string) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error: any) {
    console.error('Error opening external URL:', error);
    return { success: false, error: error?.message || String(error) };
  }
});

