# GitHub Secrets для Chat Desk

**Куда:** GitHub → репозиторий `chat.goranked` → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

---

## Релиз через GitHub Actions (Windows + macOS)

Файл: `.github/workflows/build.yml`

**Как выпустить версию менеджерам**

1. В `package.json` увеличить `"version"` (например `2.0.23`) — так же попадёт в `releases.json` при деплое на сайт.
2. Закоммитить и запушить изменения.
3. Создать и запушить тег: `git tag v2.0.23 && git push origin v2.0.23`  
   (номер тега без `v` в имени должен совпадать с `version` в `package.json`.)

После push тега запустятся jobs: **Windows** (NSIS, `latest.yml`), затем **macOS** (DMG, zip, `latest-mac.yml`) — mac идёт после Windows, чтобы один раз создать GitHub Release и без гонок добавить файлы.

**Ручной запуск workflow:** Actions → **Build and Release** → **Run workflow**. В поле **«Use workflow from»** обязательно выберите **тег** (ветка `main` не подойдёт — jobs пропускаются).

**Автообновление приложения:** в сборке зашит `UPDATE_URL=https://goranked.gg/chat-desk/releases` (generic). На сервер файлы попадают при настроенном деплое (см. ниже).

---

## Обязательные (для сборки)

| Name | Value | Откуда взять |
|------|-------|--------------|
| `REVERB_APP_KEY` | Ключ Reverb | Файл `/var/www/master/data/www/chatapp/.env` — строка `REVERB_APP_KEY=...` |

---

## Для deploy на goranked.gg (опционально)

Если не задать — артефакты останутся только в GitHub Release, на сервер не скопируются.

| Name | Value | Пример |
|------|-------|--------|
| `DEPLOY_HOST` | IP или хост сервера | `116.203.87.225` или `goranked.gg` |
| `DEPLOY_USER` | SSH-пользователь | `root` |
| `SSH_PRIVATE_KEY` | Приватный SSH-ключ целиком | Содержимое `~/.ssh/id_rsa` (или другого ключа) |
| `DEPLOY_PATH` | Путь на сервере (опционально) | `/var/www/master/data/www/goranked.gg/public/chat-desk/releases` |

---

## Опциональные (если не стандартные)

| Name | Value по умолчанию |
|------|--------------------|
| `REVERB_HOST` | `goranked.gg` |
| `REVERB_PORT` | `443` |
| `REVERB_SCHEME` | `https` |
| `API_URL` | `https://goranked.gg` |

---

## Как получить REVERB_APP_KEY

```bash
grep REVERB_APP_KEY /var/www/master/data/www/chatapp/.env
```

Скопировать значение после `=` (без кавычек).

---

## Как получить SSH_PRIVATE_KEY

Если ключ уже есть на сервере:

```bash
cat ~/.ssh/id_rsa
```

Скопировать **весь** вывод (включая `-----BEGIN ...-----` и `-----END ...-----`).

Если ключа нет — создать:

```bash
ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/github_deploy -N ""
cat ~/.ssh/github_deploy
```

Потом добавить публичный ключ на сервер:

```bash
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
```

---

## Итого — что вводить

1. **REVERB_APP_KEY** — из `.env` (обязательно)
2. **DEPLOY_HOST** — `116.203.87.225` или `goranked.gg`
3. **DEPLOY_USER** — `root` (или ваш SSH-пользователь)
4. **SSH_PRIVATE_KEY** — полное содержимое приватного ключа
5. **DEPLOY_PATH** — можно не задавать (будет дефолтный путь)
