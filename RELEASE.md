# Чеклист релізу Chat Desk

## Швидкий реліз (Linux)

```bash
cd /var/www/master/data/www/chatapp
npm version patch
./scripts/build-and-deploy.sh
```

## Повний чеклист

1. [ ] Внести зміни в код
2. [ ] `npm version patch` (або minor/major)
3. [ ] `./scripts/build-and-deploy.sh` (Linux) або `scripts\build-and-deploy.bat` (Windows)
4. [ ] Перевірити: https://goranked.gg/chat-desk/releases/latest.yml повертає нову версію
5. [ ] Співробітники отримають оновлення автоматично

## Важливо

- **UPDATE_URL** — обов'язково при збірці, інакше автооновлення не працюватиме
- **.env** — має містити REVERB_APP_KEY для production build
- **Docker** — потрібен для збірки Windows на Linux (образ electronuserland/builder:wine)

## Ручна установка (якщо автооновлення не спрацювало)

https://goranked.gg/chat-desk/releases/Goranked-Chat-Desk-Setup-X.X.X.exe

## Реліз через GitHub Actions (приватний репо)

1. Запушити тег: `git tag v2.0.19 && git push origin v2.0.19`
2. Workflow збере Windows і Mac, завантажить у GitHub Release
3. Якщо налаштовано deploy — артефакти скопіюються на goranked.gg

### Секрети для deploy на goranked.gg

У Settings → Secrets and variables → Actions додати:

| Секрет | Опис |
|--------|------|
| `REVERB_APP_KEY` | Ключ Reverb (обов'язково для збірки) |
| `DEPLOY_HOST` | IP або хост сервера goranked.gg |
| `DEPLOY_USER` | SSH-користувач на сервері |
| `SSH_PRIVATE_KEY` | Приватний SSH-ключ для deploy |
| `DEPLOY_PATH` | (опційно) Шлях, за замовчуванням `/var/www/master/data/www/goranked.gg/public/chat-desk/releases` |

Якщо `DEPLOY_HOST` не задано — deploy пропускається, артефакти лишаються тільки в GitHub Release.
