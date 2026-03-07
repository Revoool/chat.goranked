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
