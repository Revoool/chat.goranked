export interface ElectronAPI {
  storeToken: (token: string) => Promise<{ success: boolean; error?: string; allowFallback?: boolean }>;
  getToken: () => Promise<{ success: boolean; token: string | null; error?: string }>;
  deleteToken: () => Promise<{ success: boolean; error?: string }>;
  checkForUpdates: () => Promise<{ success: boolean; message?: string; error?: string; updateInfo?: any }>;
  getAppVersion: () => Promise<{ version: string }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

