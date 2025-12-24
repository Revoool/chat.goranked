# Быстрая инструкция по обновлению

## Процесс обновления (3 шага)

### 1. Внести изменения и обновить версию

```bash
# Отредактируйте код
# Обновите версию в package.json (например: "version": "1.0.11")
```

### 2. Закоммитить и запушить

```bash
git add .
git commit -m "Описание изменений"
git push origin main
```

### 3. Создать тег и релиз

```bash
git tag v1.0.11
git push origin v1.0.11
```

**Готово!** GitHub Actions автоматически соберет и опубликует релиз.

---

## Команды для работы с Git (Windows)

Если git не в PATH, используйте полный путь:

```powershell
& "C:\Program Files\Git\bin\git.exe" add .
& "C:\Program Files\Git\bin\git.exe" commit -m "Сообщение"
& "C:\Program Files\Git\bin\git.exe" push origin main
& "C:\Program Files\Git\bin\git.exe" tag v1.0.11
& "C:\Program Files\Git\bin\git.exe" push origin v1.0.11
```

---

## Проверка статуса

- **GitHub Actions:** https://github.com/Revoool/chat.goranked/actions
- **Релизы:** https://github.com/Revoool/chat.goranked/releases

---

## Локальная сборка (если нужно проверить)

```bash
npm run build:win
```

Файлы будут в папке `release/`

---

## Что происходит после создания тега

1. GitHub Actions запускается автоматически
2. Собирает приложение (5-10 минут)
3. Создает GitHub Release
4. Загружает файлы для автообновления
5. Приложения сотрудников получают обновление автоматически (в течение 30 минут)

---

## Пример полного цикла

```bash
# 1. Обновили версию в package.json до 1.0.12
# 2. Внесли изменения в код

# 3. Коммит и пуш
git add .
git commit -m "Добавлен новый функционал"
git push origin main

# 4. Создать тег
git tag v1.0.12
git push origin v1.0.12

# 5. Ждем завершения GitHub Actions (5-10 минут)
# 6. Проверяем релиз: https://github.com/Revoool/chat.goranked/releases
```

---

## Важно

- Версия в `package.json` должна совпадать с тегом (без `v`)
- Тег должен начинаться с `v` (например: `v1.0.12`)
- После создания тега GitHub Actions запускается автоматически
- Не нужно вручную раздавать файлы сотрудникам - всё автоматически

