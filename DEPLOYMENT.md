# Инструкция по сборке и развертыванию GoRanked Chat Desk

## 📦 Сборка приложения

### Требования

- Node.js 18+ 
- npm или yarn
- Для сборки Windows: Windows или macOS/Linux с Wine
- Для сборки macOS: macOS (для подписи приложения нужен Apple Developer аккаунт)

### Установка зависимостей

```bash
cd chatapp
npm install
```

### Сборка для разных платформ

#### macOS (DMG)
```bash
npm run build:mac
```

Результат: `release/GoRanked Chat Desk-1.0.0.dmg` и `release/GoRanked Chat Desk-1.0.0-arm64.dmg`

#### Windows (NSIS Installer)
```bash
npm run build:win
```

Результат: `release/GoRanked Chat Desk Setup 1.0.0.exe`

#### Linux (AppImage/Deb/RPM)
```bash
npm run build:linux
```

### Полная сборка (все платформы)
```bash
npm run build
```

## 🚀 Развертывание на сервере

### Вариант 1: Простой HTTP сервер (рекомендуется для начала)

#### 1. Создайте директорию для файлов на сервере

```bash
mkdir -p /var/www/downloads/goranked-chat-desk
```

#### 2. Скопируйте установщики

```bash
# После сборки скопируйте файлы из release/
scp release/*.dmg user@server:/var/www/downloads/goranked-chat-desk/
scp release/*.exe user@server:/var/www/downloads/goranked-chat-desk/
```

#### 3. Настройте Nginx для раздачи файлов

```nginx
server {
    listen 80;
    server_name downloads.goranked.gg;

    root /var/www/downloads/goranked-chat-desk;
    index index.html;

    location / {
        autoindex on;
        autoindex_exact_size off;
        autoindex_localtime on;
        
        # Разрешить скачивание больших файлов
        client_max_body_size 500M;
    }

    # Кеширование для установщиков
    location ~* \.(dmg|exe|AppImage|deb|rpm)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}
```

#### 4. Создайте страницу для скачивания

Создайте `index.html` в директории:

```html
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GoRanked Chat Desk - Скачать</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background: #1a1a1a;
            color: #fff;
        }
        .download-card {
            background: #2a2a2a;
            border-radius: 12px;
            padding: 30px;
            margin: 20px 0;
            border: 1px solid #3a3a3a;
        }
        .download-btn {
            display: inline-block;
            padding: 12px 24px;
            background: #ff6b00;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            transition: background 0.2s;
        }
        .download-btn:hover {
            background: #ff8c42;
        }
        h1 { color: #ff6b00; }
        .version { color: #999; font-size: 14px; }
    </style>
</head>
<body>
    <h1>GoRanked Chat Desk</h1>
    <p class="version">Версия 1.0.0</p>
    
    <div class="download-card">
        <h2>📱 macOS</h2>
        <p>Для Mac с процессором Intel или Apple Silicon</p>
        <a href="GoRanked Chat Desk-1.0.0.dmg" class="download-btn">Скачать для macOS (Intel)</a>
        <br><br>
        <a href="GoRanked Chat Desk-1.0.0-arm64.dmg" class="download-btn">Скачать для macOS (Apple Silicon)</a>
    </div>

    <div class="download-card">
        <h2>🪟 Windows</h2>
        <p>Для Windows 10/11</p>
        <a href="GoRanked Chat Desk Setup 1.0.0.exe" class="download-btn">Скачать для Windows</a>
    </div>

    <div class="download-card">
        <h2>🐧 Linux</h2>
        <p>Для Linux дистрибутивов</p>
        <a href="GoRanked Chat Desk-1.0.0.AppImage" class="download-btn">Скачать AppImage</a>
    </div>

    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #3a3a3a;">
        <h3>Инструкция по установке</h3>
        <h4>macOS:</h4>
        <ol>
            <li>Скачайте .dmg файл</li>
            <li>Откройте файл и перетащите приложение в папку Applications</li>
            <li>При первом запуске может потребоваться разрешение в Системных настройках</li>
        </ol>
        
        <h4>Windows:</h4>
        <ol>
            <li>Скачайте .exe файл</li>
            <li>Запустите установщик и следуйте инструкциям</li>
            <li>Приложение будет установлено в Program Files</li>
        </ol>
    </div>
</body>
</html>
```

### Вариант 2: Использование GitHub Releases (рекомендуется)

#### 1. Создайте репозиторий на GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/your-org/goranked-chat-desk.git
git push -u origin main
```

#### 2. Настройте GitHub Actions для автоматической сборки

Создайте `.github/workflows/build.yml`:

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: |
          if [ "${{ matrix.os }}" == "macos-latest" ]; then
            npm run build:mac
          elif [ "${{ matrix.os }}" == "windows-latest" ]; then
            npm run build:win
          else
            npm run build:linux
          fi
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: ${{ matrix.os }}-build
          path: release/
      
      - name: Create Release
        if: matrix.os == 'macos-latest'
        uses: softprops/action-gh-release@v1
        with:
          files: release/*
          tag_name: ${{ github.ref }}
          name: Release ${{ github.ref }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

#### 3. Создайте релиз

```bash
git tag v1.0.0
git push origin v1.0.0
```

GitHub Actions автоматически соберет приложение и создаст релиз с установщиками.

### Вариант 3: Использование собственного API для раздачи

Создайте простой API endpoint на вашем бэкенде:

```php
// Laravel пример
Route::get('/api/downloads/chat-desk', function () {
    return response()->json([
        'version' => '1.0.0',
        'downloads' => [
            'macos' => [
                'intel' => 'https://downloads.goranked.gg/chat-desk/GoRanked-Chat-Desk-1.0.0.dmg',
                'arm64' => 'https://downloads.goranked.gg/chat-desk/GoRanked-Chat-Desk-1.0.0-arm64.dmg',
            ],
            'windows' => 'https://downloads.goranked.gg/chat-desk/GoRanked-Chat-Desk-Setup-1.0.0.exe',
            'linux' => 'https://downloads.goranked.gg/chat-desk/GoRanked-Chat-Desk-1.0.0.AppImage',
        ],
        'release_notes' => 'Первая версия GoRanked Chat Desk',
    ]);
});
```

## 🔄 Автообновления (опционально)

Для автоматических обновлений можно использовать `electron-updater`:

### 1. Установите пакет

```bash
npm install electron-updater
```

### 2. Настройте в `main.ts`

```typescript
import { autoUpdater } from 'electron-updater';

// Проверка обновлений при запуске
app.whenReady().then(() => {
  autoUpdater.checkForUpdatesAndNotify();
});

// Настройка сервера обновлений
autoUpdater.setFeedURL({
  provider: 'generic',
  url: 'https://downloads.goranked.gg/chat-desk/updates/'
});
```

### 3. Обновите `package.json`

```json
{
  "build": {
    "publish": {
      "provider": "generic",
      "url": "https://downloads.goranked.gg/chat-desk/updates/"
    }
  }
}
```

## 📝 Чеклист перед релизом

- [ ] Обновить версию в `package.json`
- [ ] Проверить все переменные окружения (API_URL, WS_URL и т.д.)
- [ ] Протестировать сборку на целевой платформе
- [ ] Проверить иконки приложения (assets/icon.ico, assets/icon.icns)
- [ ] Обновить README.md с инструкциями
- [ ] Создать релизные заметки (CHANGELOG.md)
- [ ] Протестировать установку на чистой системе
- [ ] Проверить работу звуковых уведомлений
- [ ] Проверить работу WebSocket подключения

## 🔐 Подпись приложения (macOS/Windows)

### macOS (требуется Apple Developer аккаунт)

```json
{
  "build": {
    "mac": {
      "identity": "Developer ID Application: Your Name (TEAM_ID)"
    }
  }
}
```

### Windows (требуется код-подпись сертификат)

```json
{
  "build": {
    "win": {
      "certificateFile": "path/to/certificate.pfx",
      "certificatePassword": "password"
    }
  }
}
```

## 📞 Поддержка

При возникновении проблем:
1. Проверьте логи приложения (в консоли разработчика)
2. Убедитесь, что API доступен
3. Проверьте настройки CORS на сервере
4. Убедитесь, что WebSocket сервер работает

