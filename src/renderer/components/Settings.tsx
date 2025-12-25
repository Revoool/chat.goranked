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

const Settings: React.FC = () => {
  const { user } = useAuthStore();
  const [appVersion, setAppVersion] = useState<string>("1.0.0");
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);

  useEffect(() => {
    // Get app version
    if (window.electronAPI) {
      window.electronAPI.getAppVersion().then((result) => {
        setAppVersion(result.version);
      });
      
      // Listen for update download progress
      const cleanup = window.electronAPI.onUpdateDownloadProgress?.((progress: any) => {
        console.log('📥 Update download progress:', progress);
        setDownloadProgress(progress.percent || 0);
        if (progress.percent >= 100) {
          setTimeout(() => setDownloadProgress(null), 2000);
        }
      });
      
      return () => {
        if (cleanup) cleanup();
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

    try {
      const result = await window.electronAPI.checkForUpdates();
      if (result.success) {
        if (result.updateInfo && result.updateInfo.version) {
          setUpdateStatus(
            `Доступна нова версія: ${result.updateInfo.version}. Завантаження почнеться автоматично.`
          );
        } else {
          setUpdateStatus(
            result.message ||
              "Перевірка оновлень запущена. Якщо доступна нова версія, ви отримаєте сповіщення."
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
      // Clear status message after 10 seconds (longer for errors)
      setTimeout(() => setUpdateStatus(null), 10000);
    }
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
                  disabled={isCheckingUpdates || !window.electronAPI}
                >
                  {isCheckingUpdates 
                    ? "Перевірка..." 
                    : downloadProgress !== null 
                      ? `Завантаження ${Math.round(downloadProgress)}%` 
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
          </div>
        </section>
      </div>
    </div>
  );
};

export default Settings;
