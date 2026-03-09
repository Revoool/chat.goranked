# Goranked Chat Desk

Десктопне застосування для операторів підтримки Goranked.

## Технології

- **Electron** — десктопна обгортка
- **React + TypeScript** — UI фреймворк
- **TanStack Query** — управління запитами та кешем
- **Zustand** — управління станом
- **WebSocket** — real-time оновлення
- **Electron safeStorage** — безпечне зберігання токенів

## Встановлення залежностей

```bash
npm install
```

## Розробка

```bash
npm run dev
```

Запускає Webpack dev server на порту 3000 та Electron.

---

## Інструкція: як зібрати та випустити нову версію

### Передумови

- **Node.js 18+**
- **Docker** (для збірки на Linux)
- Файл `.env` з `REVERB_APP_KEY` (для production build)

### Крок 1: Оновити версію

```bash
cd /var/www/master/data/www/chatapp

# patch = 2.0.17 → 2.0.18 (баги, дрібні зміни)
npm version patch

# minor = 2.0.17 → 2.1.0 (нова функціональність)
npm version minor

# major = 2.0.17 → 3.0.0 (breaking changes)
npm version major
```

### Крок 2: Зібрати та задеплоїти

#### Варіант A: Linux (рекомендовано — на сервері)

```bash
cd /var/www/master/data/www/chatapp
./scripts/build-and-deploy.sh
```

Скрипт:
1. Збирає через Docker (electronuserland/builder:wine)
2. Копіює файли в `goranked.gg/public/chat-desk/releases/`
3. Оновлює `releases.json`

#### Варіант B: Windows

```bash
cd chatapp
scripts\build-and-deploy.bat
```

#### Варіант C: macOS (тільки на Mac!)

Збірка Mac-версії можлива лише на macOS (обмеження electron-builder):

```bash
cd /var/www/master/data/www/chatapp
./scripts/build-and-deploy-mac.sh
```

Після деплою файли `.dmg` з’являться на сервері, і посилання для Mac будуть доступні.

#### Варіант D: Вручну (покроково)

```bash
# 1. Збірка (обов'язково з UPDATE_URL!)
export $(grep -v '^#' .env | xargs)  # Linux: завантажити .env
UPDATE_URL=https://goranked.gg/chat-desk/releases npm run build

# 2. Збірка Windows-інсталятора
# Linux (потрібен Docker):
docker run --rm -v "$(pwd)":/project \
  -e UPDATE_URL=https://goranked.gg/chat-desk/releases \
  -e REVERB_APP_KEY=... -e API_URL=https://goranked.gg \
  -e CSC_IDENTITY_AUTO_DISCOVERY=false \
  electronuserland/builder:wine \
  /bin/bash -c "cd /project && npm run build && npx electron-builder --win --x64 --publish never"

# Windows:
set UPDATE_URL=https://goranked.gg/chat-desk/releases
npm run build:win:installer

# 3. Деплой
npm run deploy
```

### Крок 3: Changelog (опційно)

```bash
CHANGELOG="Виправлено баг X, додано Y" npm run deploy
```

### Що потрапляє на сервер

У `goranked.gg/public/chat-desk/releases/`:

| Файл | Призначення |
|------|-------------|
| `latest.yml` | Метадані для electron-updater (Windows) |
| `latest-mac.yml` | Метадані для electron-updater (macOS) |
| `Goranked-Chat-Desk-Setup-X.X.X.exe` | Інсталятор Windows |
| `Goranked-Chat-Desk-X.X.X-arm64.dmg` | macOS Apple Silicon (M1/M2/M3) |
| `Goranked-Chat-Desk-X.X.X-x64.dmg` | macOS Intel |
| `*.blockmap` | Delta-оновлення |
| `releases.json` | Історія версій (оновлюється deploy) |

### Посилання для завантаження

**Windows:**
- https://goranked.gg/chat-desk/releases/Goranked-Chat-Desk-Setup-2.0.18.exe

**macOS** (потрібно зібрати на Mac і задеплоїти):
- Apple Silicon (M1/M2/M3): https://goranked.gg/chat-desk/releases/Goranked-Chat-Desk-2.0.18-arm64.dmg
- Intel: https://goranked.gg/chat-desk/releases/Goranked-Chat-Desk-2.0.18-x64.dmg

*(Замініть 2.0.18 на актуальну версію з package.json)*

### Після деплою

Співробітники отримають оновлення:
- при наступному запуску програми
- або при натисканні «Перевірити оновлення» в налаштуваннях

---

## Розробка

### Тестовий вхід

Для реального API — email і пароль оператора/менеджера Goranked.

### Функціональність

- ✅ Авторизація, безпечне зберігання токена
- ✅ Список чатів, фільтри
- ✅ Діалог, відправка повідомлень
- ✅ WebSocket real-time
- ✅ Світла/темна тема
- ✅ Картка клієнта

---

---

## Мобільна версія (Capacitor)

Додаток підтримує iOS та Android через Capacitor.

### Збірка для мобільних

```bash
# 1. Зібрати web-версію
npm run build:web

# 2. Синхронізувати з нативними проєктами
npx cap sync

# 3. Відкрити в Xcode (macOS) або Android Studio
npx cap open ios
npx cap open android
```

### Швидкі команди

```bash
npm run cap:sync    # build:web + cap sync
npm run cap:ios     # cap:sync + відкрити Xcode
npm run cap:android # cap:sync + відкрити Android Studio
```

### Мобільний дизайн

- **Нижня навігація** замість бічної панелі на екранах < 768px
- **Список чатів / чат** — показується один екран, кнопка «Назад» для повернення
- **Touch-friendly** — мінімум 44px для кнопок
- **Safe area** — підтримка вирізів (notch) на iPhone

### Публікація

- **iOS:** потрібен Apple Developer Account ($99/рік)
- **Android:** Google Play Developer ($25 одноразово)

---

## Ліцензія

ISC

