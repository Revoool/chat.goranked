export interface ElectronAPI {
  storeToken: (token: string) => Promise<{ success: boolean; error?: string; allowFallback?: boolean }>;
  getToken: () => Promise<{ success: boolean; token: string | null; error?: string }>;
  deleteToken: () => Promise<{ success: boolean; error?: string }>;
  checkForUpdates: () => Promise<{ success: boolean; message?: string; error?: string; updateInfo?: any; currentVersion?: string }>;
  downloadUpdate: () => Promise<{ success: boolean; message?: string; error?: string; updateInfo?: any }>;
  getAppVersion: () => Promise<{ version: string }>;
  onUpdateAvailable: (callback: (info: any) => void) => (() => void) | undefined;
  onUpdateNotAvailable: (callback: (info: any) => void) => (() => void) | undefined;
  onUpdateError: (callback: (error: any) => void) => (() => void) | undefined;
  onUpdateDownloadProgress: (callback: (progress: any) => void) => (() => void) | undefined;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

