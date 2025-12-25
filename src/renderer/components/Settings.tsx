import React, { useState, useEffect } from "react";
import { useAuthStore } from "../store/authStore";
import "../styles/Settings.css";

interface SettingsState {
  language: "ru" | "uk" | "en";
  sendMessageKey: "enter" | "ctrl-enter";
  notifications: {
    enabled: boolean;
    sound: boolean;
    doNotDisturb: boolean;
  };
  connection: {
    apiUrl: string;
    environment: "production" | "staging" | "dev";
  };
}

interface UpdateInfo {
  version: string;
  releaseDate?: string;
  changelog?: string;
}

const Settings: React.FC = () => {
  const { user } = useAuthStore();
  const [appVersion, setAppVersion] = useState<string>("1.0.0");
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    // Get app version
    if (window.electronAPI) {
      window.electronAPI.getAppVersion().then((result) => {
        setAppVersion(result.version);
      });
      
      // Listen for update download progress from IPC
      const cleanupIPC = window.electronAPI.onUpdateDownloadProgress?.((progress: any) => {
        console.log('📥 Update download progress (IPC):', progress);
        setDownloadProgress(progress.percent || 0);
        setIsDownloading(progress.percent < 100);
        if (progress.percent >= 100) {
          setIsDownloading(false);
          setUpdateStatus('Оновлення завантажено! Додаток буде перезапущено для встановлення.');
          setTimeout(() => setDownloadProgress(null), 5000);
        }
      });

      // Listen for update events from window events (from App.tsx)
      const handleUpdateAvailable = (event: CustomEvent) => {
        console.log('📥 Update available (event):', event.detail);
        const info = event.detail;
        setUpdateInfo({
          version: info.version || info.tag?.replace('v', '') || '',
          releaseDate: info.releaseDate,
          changelog: info.releaseNotes || info.changelog || '',
        });
        setShowUpdateModal(true);
      };

      const handleUpdateProgress = (event: CustomEvent) => {
        const progress = event.detail;
        console.log('📥 Update progress (event):', progress);
        setDownloadProgress(progress.percent || 0);
        setIsDownloading(progress.percent < 100);
        if (progress.percent >= 100) {
          setIsDownloading(false);
          setUpdateStatus('Оновлення завантажено! Додаток буде перезапущено для встановлення.');
        }
      };

      const handleUpdateNotAvailable = () => {
        setUpdateStatus('Ви використовуєте останню версію');
        setTimeout(() => setUpdateStatus(null), 5000);
      };

      const handleUpdateError = (event: CustomEvent) => {
        const error = event.detail;
        setUpdateStatus(`Помилка: ${error.message || 'Невідома помилка'}`);
        setIsDownloading(false);
        setTimeout(() => setUpdateStatus(null), 10000);
      };

      const handleUpdateDownloaded = (event: CustomEvent) => {
        const info = event.detail;
        console.log('✅ Update downloaded (Settings):', info);
        setIsDownloading(false);
        setDownloadProgress(100);
        setUpdateStatus(`Оновлення ${info.version} завантажено! Додаток буде перезапущено для встановлення.`);
        setTimeout(() => setDownloadProgress(null), 5000);
      };

      window.addEventListener('update-available', handleUpdateAvailable as EventListener);
      window.addEventListener('update-download-progress', handleUpdateProgress as EventListener);
      window.addEventListener('update-not-available', handleUpdateNotAvailable);
      window.addEventListener('update-error', handleUpdateError as EventListener);
      window.addEventListener('update-downloaded', handleUpdateDownloaded as EventListener);
      
      return () => {
        if (cleanupIPC) cleanupIPC();
        window.removeEventListener('update-available', handleUpdateAvailable as EventListener);
        window.removeEventListener('update-download-progress', handleUpdateProgress as EventListener);
        window.removeEventListener('update-not-available', handleUpdateNotAvailable);
        window.removeEventListener('update-error', handleUpdateError as EventListener);
        window.removeEventListener('update-downloaded', handleUpdateDownloaded as EventListener);
      };
    } else {
      // Fallback to package.json version in dev mode
      setAppVersion(process.env.npm_package_version || "1.0.0");
    }
  }, []);

  const handleCheckForUpdates = async () => {
    if (!window.electronAPI) {
      setUpdateStatus(
        "Перевірка оновлень доступна тільки в встановленій версії додатку"
      );
      return;
    }

    setIsCheckingUpdates(true);
    setUpdateStatus(null);
    setShowUpdateModal(false);
    setUpdateInfo(null);

    try {
      const result = await window.electronAPI.checkForUpdates();
      if (result.success) {
        if (result.updateInfo && result.updateInfo.version) {
          // Show update modal with changelog
          setUpdateInfo({
            version: result.updateInfo.version,
            releaseDate: result.updateInfo.releaseDate,
            changelog: result.updateInfo.changelog || '',
          });
          setShowUpdateModal(true);
        } else {
          setUpdateStatus(
            result.message || "Ви використовуєте останню версію"
          );
        }
      } else {
        const errorMsg =
          result.message || result.error || "Помилка при перевірці оновлень";
        setUpdateStatus(errorMsg);
        console.error("Update check failed:", result);
      }
    } catch (error: any) {
      const errorMsg = "Помилка: " + (error.message || "Невідома помилка");
      setUpdateStatus(errorMsg);
      console.error("Update check error:", error);
    } finally {
      setIsCheckingUpdates(false);
      setTimeout(() => setUpdateStatus(null), 10000);
    }
  };

  const handleDownloadUpdate = async () => {
    if (!window.electronAPI || !updateInfo) return;

    setIsDownloading(true);
    setShowUpdateModal(false);
    setUpdateStatus(`Завантаження версії ${updateInfo.version}...`);

    try {
      const result = await window.electronAPI.downloadUpdate();
      if (result.success) {
        setUpdateStatus(`Завантаження розпочато. Прогрес відображається нижче.`);
      } else {
        setUpdateStatus(result.error || "Помилка при завантаженні");
        setIsDownloading(false);
      }
    } catch (error: any) {
      setUpdateStatus("Помилка: " + (error.message || "Невідома помилка"));
      setIsDownloading(false);
    }
  };

  const parseChangelog = (changelog: string): string => {
    if (!changelog) return 'Оновлення не містить опису змін.';
    
    // Remove HTML tags and clean up
    let text = changelog
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
    
    // If empty after cleaning, return default message
    if (!text) return 'Оновлення не містить опису змін.';
    
    return text;
  };

  const [settings, setSettings] = useState<SettingsState>({
    language:
      (localStorage.getItem("settings.language") as "ru" | "uk" | "en") || "ru",
    sendMessageKey:
      (localStorage.getItem("settings.sendMessageKey") as
        | "enter"
        | "ctrl-enter") || "enter",
    notifications: {
      enabled:
        localStorage.getItem("settings.notifications.enabled") !== "false",
      sound: localStorage.getItem("settings.notifications.sound") !== "false",
      doNotDisturb:
        localStorage.getItem("settings.notifications.doNotDisturb") === "true",
    },
    connection: {
      apiUrl:
        localStorage.getItem("settings.connection.apiUrl") ||
        process.env.API_URL ||
        "https://goranked.gg",
      environment:
        (localStorage.getItem("settings.connection.environment") as
          | "production"
          | "staging"
          | "dev") || "production",
    },
  });

  useEffect(() => {
    // Save settings to localStorage whenever they change
    localStorage.setItem("settings.language", settings.language);
    localStorage.setItem("settings.sendMessageKey", settings.sendMessageKey);
    localStorage.setItem(
      "settings.notifications.enabled",
      String(settings.notifications.enabled)
    );
    localStorage.setItem(
      "settings.notifications.sound",
      String(settings.notifications.sound)
    );
    localStorage.setItem(
      "settings.notifications.doNotDisturb",
      String(settings.notifications.doNotDisturb)
    );
    localStorage.setItem(
      "settings.connection.apiUrl",
      settings.connection.apiUrl
    );
    localStorage.setItem(
      "settings.connection.environment",
      settings.connection.environment
    );
  }, [settings]);

  const updateSettings = (updates: Partial<SettingsState>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  };

  const updateNotifications = (
    updates: Partial<SettingsState["notifications"]>
  ) => {
    setSettings((prev) => ({
      ...prev,
      notifications: { ...prev.notifications, ...updates },
    }));
  };

  const updateConnection = (updates: Partial<SettingsState["connection"]>) => {
    setSettings((prev) => ({
      ...prev,
      connection: { ...prev.connection, ...updates },
    }));
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h2>Налаштування</h2>
        <p className="settings-subtitle">Управління параметрами додатку</p>
      </div>

      <div className="settings-content">
        {/* Profile Section */}
        <section className="settings-section">
          <h3 className="settings-section-title">Профіль</h3>
          <div className="settings-section-content">
            <div className="settings-field">
              <label>Ім'я</label>
              <div className="settings-value">{user?.name || "Не вказано"}</div>
            </div>
            <div className="settings-field">
              <label>Email</label>
              <div className="settings-value">
                {user?.email || "Не вказано"}
              </div>
            </div>
            <div className="settings-field">
              <label>Роль</label>
              <div className="settings-value">{user?.role || "agent"}</div>
            </div>
          </div>
        </section>

        {/* Language Section */}
        <section className="settings-section">
          <h3 className="settings-section-title">Мова інтерфейсу</h3>
          <div className="settings-section-content">
            <div className="settings-field">
              <label>Виберіть мову</label>
              <select
                value={settings.language}
                onChange={(e) =>
                  updateSettings({
                    language: e.target.value as "ru" | "uk" | "en",
                  })
                }
                className="settings-select"
              >
                <option value="ru">Русский</option>
                <option value="uk">Українська</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
        </section>

        {/* Hotkeys Section */}
        <section className="settings-section">
          <h3 className="settings-section-title">Гарячі клавіші</h3>
          <div className="settings-section-content">
            <div className="settings-field">
              <label>Відправка повідомлення</label>
              <div className="settings-radio-group">
                <label className="settings-radio">
                  <input
                    type="radio"
                    name="sendMessageKey"
                    value="enter"
                    checked={settings.sendMessageKey === "enter"}
                    onChange={(e) =>
                      updateSettings({
                        sendMessageKey: e.target.value as
                          | "enter"
                          | "ctrl-enter",
                      })
                    }
                  />
                  <span>Enter</span>
                </label>
                <label className="settings-radio">
                  <input
                    type="radio"
                    name="sendMessageKey"
                    value="ctrl-enter"
                    checked={settings.sendMessageKey === "ctrl-enter"}
                    onChange={(e) =>
                      updateSettings({
                        sendMessageKey: e.target.value as
                          | "enter"
                          | "ctrl-enter",
                      })
                    }
                  />
                  <span>Ctrl + Enter</span>
                </label>
              </div>
              <p className="settings-hint">
                {settings.sendMessageKey === "enter"
                  ? "Натисніть Enter для відправки, Shift+Enter для нового рядка"
                  : "Натисніть Ctrl+Enter для відправки, Enter для нового рядка"}
              </p>
            </div>
          </div>
        </section>

        {/* Notifications Section */}
        <section className="settings-section">
          <h3 className="settings-section-title">Сповіщення</h3>
          <div className="settings-section-content">
            <div className="settings-field">
              <label className="settings-toggle-label">
                <input
                  type="checkbox"
                  checked={settings.notifications.enabled}
                  onChange={(e) =>
                    updateNotifications({ enabled: e.target.checked })
                  }
                  className="settings-toggle"
                />
                <span>Увімкнути сповіщення</span>
              </label>
            </div>
            <div className="settings-field">
              <label className="settings-toggle-label">
                <input
                  type="checkbox"
                  checked={settings.notifications.sound}
                  onChange={(e) =>
                    updateNotifications({ sound: e.target.checked })
                  }
                  disabled={!settings.notifications.enabled}
                  className="settings-toggle"
                />
                <span>Звук сповіщень</span>
              </label>
            </div>
            <div className="settings-field">
              <label className="settings-toggle-label">
                <input
                  type="checkbox"
                  checked={settings.notifications.doNotDisturb}
                  onChange={(e) =>
                    updateNotifications({ doNotDisturb: e.target.checked })
                  }
                  disabled={!settings.notifications.enabled}
                  className="settings-toggle"
                />
                <span>Не турбувати (Do Not Disturb)</span>
              </label>
              <p className="settings-hint">
                У режимі "Не турбувати" сповіщення будуть вимкнені
              </p>
            </div>
          </div>
        </section>

        {/* Connection Section */}
        <section className="settings-section">
          <h3 className="settings-section-title">Підключення</h3>
          <div className="settings-section-content">
            <div className="settings-field">
              <label>Оточення</label>
              <select
                value={settings.connection.environment}
                onChange={(e) =>
                  updateConnection({
                    environment: e.target.value as
                      | "production"
                      | "staging"
                      | "dev",
                  })
                }
                className="settings-select"
              >
                <option value="production">Production</option>
                <option value="staging">Staging</option>
                <option value="dev">Development</option>
              </select>
            </div>
            <div className="settings-field">
              <label>API URL</label>
              <input
                type="text"
                value={settings.connection.apiUrl}
                onChange={(e) => updateConnection({ apiUrl: e.target.value })}
                className="settings-input"
                placeholder="https://goranked.gg"
              />
              <p className="settings-hint">
                Базовий URL для API запитів. Зміни набудуть чинності після
                перезапуску додатку.
              </p>
            </div>
          </div>
        </section>

        {/* Info Section */}
        <section className="settings-section">
          <h3 className="settings-section-title">Про додаток</h3>
          <div className="settings-section-content">
            <div className="settings-field">
              <label>Версія</label>
              <div className="settings-value">{appVersion}</div>
            </div>
            <div className="settings-field">
              <label>Назва</label>
              <div className="settings-value">GoRanked Chat Desk</div>
            </div>
            <div className="settings-field">
              <label>Оновлення</label>
              <div className="settings-update-section">
                <button
                  className="settings-update-btn"
                  onClick={handleCheckForUpdates}
                  disabled={isCheckingUpdates || isDownloading || !window.electronAPI}
                >
                  {isCheckingUpdates 
                    ? "Перевірка..." 
                    : isDownloading && downloadProgress !== null
                      ? `Завантаження ${Math.round(downloadProgress)}%` 
                      : isDownloading
                        ? "Завантаження..."
                        : "Перевірити оновлення"}
                </button>
                {downloadProgress !== null && downloadProgress < 100 && (
                  <div style={{ marginTop: '12px', width: '100%' }}>
                    <div style={{ 
                      width: '100%', 
                      height: '6px', 
                      backgroundColor: 'var(--graphite-medium)', 
                      borderRadius: '3px',
                      overflow: 'hidden'
                    }}>
                      <div style={{ 
                        width: `${downloadProgress}%`, 
                        height: '100%', 
                        backgroundColor: 'var(--flame-orange)',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                  </div>
                )}
                {updateStatus && (
                  <p
                    className={`settings-update-status ${
                      updateStatus.includes("Помилка") || updateStatus.includes("Ошибка") ? "error" : ""
                    }`}
                  >
                    {updateStatus}
                  </p>
                )}
                <p className="settings-hint">
                  Додаток автоматично перевіряє оновлення кожні 30 хвилин.
                  Ви також можете перевірити вручну.
                </p>
              </div>
            </div>
            
            {/* Update Modal */}
            {showUpdateModal && updateInfo && (
              <div className="update-modal-overlay" onClick={() => setShowUpdateModal(false)}>
                <div className="update-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="update-modal-header">
                    <h3>Доступне оновлення</h3>
                    <button 
                      className="update-modal-close"
                      onClick={() => setShowUpdateModal(false)}
                    >
                      ×
                    </button>
                  </div>
                  <div className="update-modal-content">
                    <div className="update-version-info">
                      <p><strong>Поточна версія:</strong> {appVersion}</p>
                      <p><strong>Нова версія:</strong> {updateInfo.version}</p>
                      {updateInfo.releaseDate && (
                        <p><strong>Дата релізу:</strong> {new Date(updateInfo.releaseDate).toLocaleDateString('uk-UA')}</p>
                      )}
                    </div>
                    <div className="update-changelog">
                      <h4>Що нового:</h4>
                      <div className="update-changelog-content">
                        {parseChangelog(updateInfo.changelog || '').split('\n').map((line, idx) => (
                          <p key={idx}>{line || '\u00A0'}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="update-modal-footer">
                    <button
                      className="update-modal-btn update-modal-btn-cancel"
                      onClick={() => setShowUpdateModal(false)}
                    >
                      Скасувати
                    </button>
                    <button
                      className="update-modal-btn update-modal-btn-confirm"
                      onClick={handleDownloadUpdate}
                    >
                      Завантажити оновлення
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Settings;
