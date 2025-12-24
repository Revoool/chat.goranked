export interface ElectronAPI {
  storeToken: (token: string) => Promise<{ success: boolean; error?: string }>;
  getToken: () => Promise<{ success: boolean; token: string | null; error?: string }>;
  deleteToken: () => Promise<{ success: boolean; error?: string }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

