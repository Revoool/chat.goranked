/**
 * Platform abstraction: Electron, Capacitor (mobile), or Web
 * Provides unified API for storage, external links, etc.
 */

const TOKEN_KEY = 'token';

export const isElectron = (): boolean => !!(typeof window !== 'undefined' && (window as any).electronAPI);
export const isCapacitor = (): boolean => {
  if (typeof window === 'undefined') return false;
  const cap = (window as any).Capacitor;
  return cap?.isNativePlatform?.() ?? false;
};
export const isMobile = (): boolean => isCapacitor() || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export const getToken = async (): Promise<string | null> => {
  if (isElectron()) {
    const r = await (window as any).electronAPI.getToken();
    return r.success ? r.token : null;
  }
  if (isCapacitor()) {
    const { Preferences } = await import('@capacitor/preferences');
    const { value } = await Preferences.get({ key: TOKEN_KEY });
    return value;
  }
  return localStorage.getItem(TOKEN_KEY);
};

export const setToken = async (token: string): Promise<void> => {
  if (isElectron()) {
    await (window as any).electronAPI.storeToken(token);
    return;
  }
  if (isCapacitor()) {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.set({ key: TOKEN_KEY, value: token });
    return;
  }
  localStorage.setItem(TOKEN_KEY, token);
};

export const deleteToken = async (): Promise<void> => {
  if (isElectron()) {
    await (window as any).electronAPI.deleteToken();
    return;
  }
  if (isCapacitor()) {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.remove({ key: TOKEN_KEY });
    return;
  }
  localStorage.removeItem(TOKEN_KEY);
};

export const openExternal = async (url: string): Promise<void> => {
  if (isElectron() && (window as any).electronAPI?.openExternal) {
    await (window as any).electronAPI.openExternal(url);
    return;
  }
  if (isCapacitor()) {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url });
    return;
  }
  window.open(url, '_blank');
};

export const getAppVersion = async (): Promise<string> => {
  if (isElectron() && (window as any).electronAPI?.getAppVersion) {
    const r = await (window as any).electronAPI.getAppVersion();
    return r.version;
  }
  if (isCapacitor()) {
    const { App } = await import('@capacitor/app');
    const info = await App.getInfo();
    return info.version;
  }
  return process.env.npm_package_version || '1.0.0';
};

export const getSoundPath = async (filename: string): Promise<string> => {
  if (isElectron() && (window as any).electronAPI?.getSoundPath) {
    const r = await (window as any).electronAPI.getSoundPath();
    if (r.success && r.path) return `${r.path}/${filename}`;
  }
  return `/sound/${filename}`;
};
