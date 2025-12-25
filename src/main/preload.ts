import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  storeToken: (token: string) => ipcRenderer.invoke('store-token', token),
  getToken: () => ipcRenderer.invoke('get-token'),
  deleteToken: () => ipcRenderer.invoke('delete-token'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  onUpdateAvailable: (callback: (info: any) => void) => {
    ipcRenderer.on('update-available', (_event, info) => callback(info));
    // Return cleanup function
    return () => {
      ipcRenderer.removeAllListeners('update-available');
    };
  },
  onUpdateNotAvailable: (callback: (info: any) => void) => {
    ipcRenderer.on('update-not-available', (_event, info) => callback(info));
    return () => {
      ipcRenderer.removeAllListeners('update-not-available');
    };
  },
  onUpdateError: (callback: (error: any) => void) => {
    ipcRenderer.on('update-error', (_event, error) => callback(error));
    return () => {
      ipcRenderer.removeAllListeners('update-error');
    };
  },
  onUpdateDownloadProgress: (callback: (progress: any) => void) => {
    ipcRenderer.on('update-download-progress', (_event, progress) => callback(progress));
    return () => {
      ipcRenderer.removeAllListeners('update-download-progress');
    };
  },
  onUpdateDownloaded: (callback: (info: any) => void) => {
    ipcRenderer.on('update-downloaded', (_event, info) => callback(info));
    return () => {
      ipcRenderer.removeAllListeners('update-downloaded');
    };
  },
  getSoundPath: () => ipcRenderer.invoke('get-sound-path'),
});

