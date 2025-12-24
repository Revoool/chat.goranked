# GoRanked Chat Desk

Десктопное приложение для операторов поддержки GoRanked.

## Технологии

- **Electron** - десктопная обертка
- **React + TypeScript** - UI фреймворк
- **TanStack Query** - управление запросами и кешем
- **Zustand** - управление состоянием
- **WebSocket** - real-time обновления
- **Keytar** - безопасное хранение токенов в OS Keychain

## Установка зависимостей

```bash
npm install
```

## Разработка

Запуск в режиме разработки:

```bash
npm run dev
```

Это запустит:
- Webpack dev server на порту 3000
- Electron приложение

## Сборка

### Windows
```bash
npm run build:win
```

### macOS
```bash
npm run build:mac
```

### Универсальная сборка
```bash
npm run build
```

Собранные файлы будут в папке `release/`.

## Структура проекта

```
chatapp/
├── src/
│   ├── main/              # Electron main process
│   │   ├── main.ts        # Главный процесс
│   │   └── preload.ts     # Preload скрипт
│   └── renderer/          # React приложение
│       ├── api/           # API клиент и WebSocket
│       ├── components/    # React компоненты
│       ├── pages/         # Страницы приложения
│       ├── store/         # Zustand stores
│       ├── styles/        # CSS стили
│       └── types/         # TypeScript типы
├── webpack.config.js       # Конфигурация для renderer
├── webpack.main.config.js  # Конфигурация для main
└── webpack.preload.config.js # Конфигурация для preload
```

## Конфигурация

По умолчанию приложение использует:
- API URL: `https://api.goranked.gg`
- WebSocket URL: `wss://api.goranked.gg/ws`

Для изменения создайте файл `.env`:
```
API_URL=https://your-api-url.com
WS_URL=wss://your-ws-url.com/ws
```

## Тестовый вход (для разработки)

В режиме разработки доступен мок-режим для тестирования без реального API:

**Тестовые учетные данные:**
- Email: `test@goranked.gg` или `demo@test.com`
- Пароль: любой (не проверяется в мок-режиме)

**Для реального API:**
Используйте реальные учетные данные от GoRanked (email и пароль оператора/менеджера).

## Функциональность

### Реализовано (MVP)
- ✅ Авторизация с безопасным хранением токена
- ✅ Список чатов с фильтрами
- ✅ Окно диалога с сообщениями
- ✅ Отправка сообщений
- ✅ WebSocket для real-time обновлений
- ✅ Темная тема по брендбуку
- ✅ Карточка клиента

### В разработке
- ⏳ Загрузка файлов
- ⏳ Быстрые ответы (canned responses)
- ⏳ Назначение чатов
- ⏳ Управление статусами и тегами
- ⏳ Уведомления ОС
- ⏳ Настройки приложения

## Обновление приложения

Приложение поддерживает автоматическое обновление через GitHub Releases. 

**Для публикации обновления:**

1. Обновите версию в `package.json`
2. Соберите приложение: `npm run build:win`
3. Создайте GitHub Release и загрузите файлы из папки `release/`

Подробная инструкция в файле [DEPLOYMENT.md](./DEPLOYMENT.md).

## Лицензия

ISC

