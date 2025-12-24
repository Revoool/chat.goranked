import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import '../styles/Settings.css';

interface SettingsState {
  language: 'ru' | 'uk' | 'en';
  sendMessageKey: 'enter' | 'ctrl-enter';
  notifications: {
    enabled: boolean;
    sound: boolean;
    doNotDisturb: boolean;
  };
  connection: {
    apiUrl: string;
    environment: 'production' | 'staging' | 'dev';
  };
}

const Settings: React.FC = () => {
  const { user } = useAuthStore();
  
  const [settings, setSettings] = useState<SettingsState>({
    language: (localStorage.getItem('settings.language') as 'ru' | 'uk' | 'en') || 'ru',
    sendMessageKey: (localStorage.getItem('settings.sendMessageKey') as 'enter' | 'ctrl-enter') || 'enter',
    notifications: {
      enabled: localStorage.getItem('settings.notifications.enabled') !== 'false',
      sound: localStorage.getItem('settings.notifications.sound') !== 'false',
      doNotDisturb: localStorage.getItem('settings.notifications.doNotDisturb') === 'true',
    },
    connection: {
      apiUrl: localStorage.getItem('settings.connection.apiUrl') || process.env.API_URL || 'https://goranked.gg',
      environment: (localStorage.getItem('settings.connection.environment') as 'production' | 'staging' | 'dev') || 'production',
    },
  });

  useEffect(() => {
    // Save settings to localStorage whenever they change
    localStorage.setItem('settings.language', settings.language);
    localStorage.setItem('settings.sendMessageKey', settings.sendMessageKey);
    localStorage.setItem('settings.notifications.enabled', String(settings.notifications.enabled));
    localStorage.setItem('settings.notifications.sound', String(settings.notifications.sound));
    localStorage.setItem('settings.notifications.doNotDisturb', String(settings.notifications.doNotDisturb));
    localStorage.setItem('settings.connection.apiUrl', settings.connection.apiUrl);
    localStorage.setItem('settings.connection.environment', settings.connection.environment);
  }, [settings]);

  const updateSettings = (updates: Partial<SettingsState>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  };

  const updateNotifications = (updates: Partial<SettingsState['notifications']>) => {
    setSettings((prev) => ({
      ...prev,
      notifications: { ...prev.notifications, ...updates },
    }));
  };

  const updateConnection = (updates: Partial<SettingsState['connection']>) => {
    setSettings((prev) => ({
      ...prev,
      connection: { ...prev.connection, ...updates },
    }));
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h2>Настройки</h2>
        <p className="settings-subtitle">Управление параметрами приложения</p>
      </div>

      <div className="settings-content">
        {/* Profile Section */}
        <section className="settings-section">
          <h3 className="settings-section-title">Профиль</h3>
          <div className="settings-section-content">
            <div className="settings-field">
              <label>Имя</label>
              <div className="settings-value">{user?.name || 'Не указано'}</div>
            </div>
            <div className="settings-field">
              <label>Email</label>
              <div className="settings-value">{user?.email || 'Не указано'}</div>
            </div>
            <div className="settings-field">
              <label>Роль</label>
              <div className="settings-value">{user?.role || 'agent'}</div>
            </div>
          </div>
        </section>

        {/* Language Section */}
        <section className="settings-section">
          <h3 className="settings-section-title">Язык интерфейса</h3>
          <div className="settings-section-content">
            <div className="settings-field">
              <label>Выберите язык</label>
              <select
                value={settings.language}
                onChange={(e) => updateSettings({ language: e.target.value as 'ru' | 'uk' | 'en' })}
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
          <h3 className="settings-section-title">Горячие клавиши</h3>
          <div className="settings-section-content">
            <div className="settings-field">
              <label>Отправка сообщения</label>
              <div className="settings-radio-group">
                <label className="settings-radio">
                  <input
                    type="radio"
                    name="sendMessageKey"
                    value="enter"
                    checked={settings.sendMessageKey === 'enter'}
                    onChange={(e) => updateSettings({ sendMessageKey: e.target.value as 'enter' | 'ctrl-enter' })}
                  />
                  <span>Enter</span>
                </label>
                <label className="settings-radio">
                  <input
                    type="radio"
                    name="sendMessageKey"
                    value="ctrl-enter"
                    checked={settings.sendMessageKey === 'ctrl-enter'}
                    onChange={(e) => updateSettings({ sendMessageKey: e.target.value as 'enter' | 'ctrl-enter' })}
                  />
                  <span>Ctrl + Enter</span>
                </label>
              </div>
              <p className="settings-hint">
                {settings.sendMessageKey === 'enter'
                  ? 'Нажмите Enter для отправки, Shift+Enter для новой строки'
                  : 'Нажмите Ctrl+Enter для отправки, Enter для новой строки'}
              </p>
            </div>
          </div>
        </section>

        {/* Notifications Section */}
        <section className="settings-section">
          <h3 className="settings-section-title">Уведомления</h3>
          <div className="settings-section-content">
            <div className="settings-field">
              <label className="settings-toggle-label">
                <input
                  type="checkbox"
                  checked={settings.notifications.enabled}
                  onChange={(e) => updateNotifications({ enabled: e.target.checked })}
                  className="settings-toggle"
                />
                <span>Включить уведомления</span>
              </label>
            </div>
            <div className="settings-field">
              <label className="settings-toggle-label">
                <input
                  type="checkbox"
                  checked={settings.notifications.sound}
                  onChange={(e) => updateNotifications({ sound: e.target.checked })}
                  disabled={!settings.notifications.enabled}
                  className="settings-toggle"
                />
                <span>Звук уведомлений</span>
              </label>
            </div>
            <div className="settings-field">
              <label className="settings-toggle-label">
                <input
                  type="checkbox"
                  checked={settings.notifications.doNotDisturb}
                  onChange={(e) => updateNotifications({ doNotDisturb: e.target.checked })}
                  disabled={!settings.notifications.enabled}
                  className="settings-toggle"
                />
                <span>Не беспокоить (Do Not Disturb)</span>
              </label>
              <p className="settings-hint">
                В режиме "Не беспокоить" уведомления будут отключены
              </p>
            </div>
          </div>
        </section>

        {/* Connection Section */}
        <section className="settings-section">
          <h3 className="settings-section-title">Подключение</h3>
          <div className="settings-section-content">
            <div className="settings-field">
              <label>Окружение</label>
              <select
                value={settings.connection.environment}
                onChange={(e) => updateConnection({ environment: e.target.value as 'production' | 'staging' | 'dev' })}
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
                Базовый URL для API запросов. Изменения вступят в силу после перезапуска приложения.
              </p>
            </div>
          </div>
        </section>

        {/* Info Section */}
        <section className="settings-section">
          <h3 className="settings-section-title">О приложении</h3>
          <div className="settings-section-content">
            <div className="settings-field">
              <label>Версия</label>
              <div className="settings-value">1.0.0</div>
            </div>
            <div className="settings-field">
              <label>Название</label>
              <div className="settings-value">Goranked Chat Desk</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Settings;

