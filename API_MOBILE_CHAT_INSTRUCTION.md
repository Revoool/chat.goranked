# Инструкция по использованию Chat API для мобильного приложения

## Общая информация

Данная инструкция описывает доступные API endpoints для интеграции функций чата в мобильное приложение.

**Базовый URL API:** `https://your-domain.com/api`

**Авторизация:** Все endpoints (кроме публичных) требуют токен авторизации через Laravel Sanctum.
- Заголовок: `Authorization: Bearer {token}`
- Или через cookie: `X-XSRF-TOKEN`

---

## 1. Быстрые ответы (Quick Replies)

### 1.1. Получить список быстрых ответов
**GET** `/api/quick-replies`

**Параметры запроса:**
- `locale` (опционально) - язык для получения текста (по умолчанию: язык приложения)

**Ответ:**
```json
{
  "data": [
    {
      "id": 1,
      "key": "greeting",
      "text": "Привет! Чем могу помочь?",
      "translations": {
        "ua": "Привіт! Чим можу допомогти?",
        "ru": "Привет! Чем могу помочь?",
        "en": "Hello! How can I help?"
      },
      "order": 0,
      "active": true
    }
  ]
}
```

**Использование в приложении:**
- Получить список активных быстрых ответов при открытии чата
- Отобразить их как кнопки или список под полем ввода
- При выборе - автоматически вставить текст в поле ввода или отправить сообщение

---

### 1.2. Получить быстрый ответ по ID
**GET** `/api/quick-replies/{id}`

**Использование:** Для получения конкретного быстрого ответа (редко используется в мобильном приложении)

---

## 2. Чаты заказов (Order Chats)

### 2.1. Получить список чатов (тредов)
**GET** `/api/chats`

**Параметры запроса:**
- `page` (опционально) - номер страницы для пагинации
- `per_page` (опционально) - количество элементов на странице

**Ответ:**
```json
{
  "data": [
    {
      "id": 123,
      "order_id": 123,
      "user": {
        "id": 1,
        "name": "Иван Иванов",
        "email": "ivan@example.com"
      },
      "booster": {
        "id": 2,
        "name": "Петр Петров"
      },
      "last_message": {
        "id": 456,
        "body": "Последнее сообщение",
        "created_at": "2024-01-15T10:30:00Z"
      },
      "unread_count": 5,
      "warning": false
    }
  ]
}
```

**Использование:**
- Отобразить список всех активных чатов
- Показать количество непрочитанных сообщений
- Отсортировать по дате последнего сообщения

---

### 2.2. Получить сообщения чата
**GET** `/api/chats/{orderId}/messages`

**Параметры запроса:**
- `orderId` (обязательно) - ID заказа
- `since_id` (опционально) - получить сообщения после указанного ID (для обновления)
- `per_page` (опционально) - количество сообщений на странице (по умолчанию: 50)
- `mark_seen` (опционально) - автоматически пометить как прочитанные (по умолчанию: true)

**Ответ:**
```json
{
  "data": [
    {
      "id": 456,
      "order_id": 123,
      "from": {
        "id": 1,
        "name": "Иван Иванов",
        "email": "ivan@example.com"
      },
      "to": {
        "id": 2,
        "name": "Петр Петров"
      },
      "body": "Текст сообщения",
      "type": "message",
      "created_at": "2024-01-15T10:30:00Z",
      "seen_admin": true
    }
  ],
  "thread": {
    "id": 123,
    "user": {...},
    "unread_count": 0
  }
}
```

**Использование:**
- Загрузить историю сообщений при открытии чата
- Использовать `since_id` для получения новых сообщений (polling или WebSocket)
- Автоматически помечать сообщения как прочитанные при открытии чата

---

### 2.3. Отправить сообщение
**POST** `/api/chats/{orderId}/messages`

**Тело запроса:**
```json
{
  "body": "Текст сообщения"
}
```

**Валидация:**
- `body` (обязательно) - текст сообщения, максимум 10000 символов

**Ответ:**
```json
{
  "data": {
    "id": 457,
    "order_id": 123,
    "from": {...},
    "body": "Текст сообщения",
    "created_at": "2024-01-15T10:35:00Z"
  }
}
```

**Использование:**
- Отправить сообщение от менеджера/админа клиенту
- Обновить UI после успешной отправки

---

### 2.4. Пометить сообщения как прочитанные
**POST** `/api/chats/{orderId}/mark-seen`

**Использование:**
- Пометить все сообщения в чате как прочитанные
- Обновить счетчик непрочитанных сообщений

---

### 2.5. Индикатор набора текста (Typing Indicator)
**POST** `/api/chats/{orderId}/typing`

**Тело запроса:**
```json
{
  "is_typing": true
}
```

**Использование:**
- Отправлять `is_typing: true` когда пользователь начинает печатать
- Отправлять `is_typing: false` когда пользователь перестает печатать (через 3-5 секунд бездействия)
- Отображать индикатор "Печатает..." в UI

---

### 2.6. Снять предупреждение с заказа
**POST** `/api/chats/{orderId}/skip`

**Использование:**
- Убрать warning статус с заказа (для админов/менеджеров)

---

## 3. Сообщения для клиентов (Client Messages)

### 3.1. Отправить сообщение в чат аккаунта
**POST** `/api/chat/account/message`

**Тело запроса (multipart/form-data):**
- `order_id` (обязательно) - ID заказа продукта
- `from_id` (обязательно) - ID отправителя
- `to_id` (обязательно) - ID получателя
- `body` (опционально) - текст сообщения
- `files[]` (опционально) - массив файлов для загрузки

**Ограничения:**
- Запрещены стоп-слова (личные данные)
- Запрещены ссылки в некоторых типах чатов
- Сообщение или файлы должны быть обязательно

**Ответ:**
```json
{
  "success": true
}
```

**Использование:**
- Клиент отправляет сообщение продавцу по заказу аккаунта
- Поддержка отправки файлов (скриншоты, документы)

---

### 3.2. Отправить сообщение в чат буста
**POST** `/api/chat/boost/message`

**Тело запроса (multipart/form-data):**
- `order_id` (обязательно) - ID заказа буста
- `from_id` (обязательно) - ID отправителя
- `to_id` (обязательно) - ID получателя
- `body` (опционально) - текст сообщения
- `files[]` (опционально) - массив файлов

**Использование:**
- Клиент отправляет сообщение бустеру по заказу буста
- Поддержка отправки файлов

---

### 3.3. Отправить сообщение в тикет
**POST** `/api/chat/ticket/message`

**Тело запроса (multipart/form-data):**
- `ticket_id` (обязательно) - ID тикета
- `from_id` (обязательно) - ID отправителя
- `to_id` (опционально) - ID получателя
- `body` (опционально) - текст сообщения
- `attachment` (опционально) - файл вложения

**Валидация файлов:**
- Разрешенные типы: jpg, jpeg, png, webp, pdf, doc, docx, txt, zip
- Максимальный размер: 10MB

**Использование:**
- Отправка сообщений в систему тикетов поддержки

---

### 3.4. Отправить сообщение по запросу продукта
**POST** `/api/chat/product-inquiry/message`

**Тело запроса (multipart/form-data):**
- `product_id` (обязательно) - ID продукта
- `from_id` (обязательно) - ID отправителя
- `to_id` (обязательно) - ID получателя
- `body` (опционально) - текст сообщения
- `files[]` (опционально) - массив файлов

**Использование:**
- Чат между покупателем и продавцом по конкретному продукту

---

### 3.5. Индикатор набора текста для клиентских чатов
**POST** `/api/chat/typing`

**Тело запроса:**
```json
{
  "order_id": 123,
  "is_typing": true,
  "chat_type": "account" // или "boost", "ticket"
}
```

**Использование:**
- Показывать индикатор "Печатает..." в клиентских чатах

---

### 3.6. Удалить сообщение
**DELETE** `/api/chat/account/message/{id}` - для аккаунтов
**DELETE** `/api/chat/boost/message/{id}` - для бустов

**Использование:**
- Удаление собственных сообщений (если разрешено)

---

## 4. Менеджерские чаты с клиентами (Manager Client Chats)

### 4.1. Получить список чатов менеджера
**GET** `/api/manager-client-chats`

**Параметры запроса:**
- `status` (опционально) - фильтр по статусу (open, closed, deferred)
- `assigned_to` (опционально) - фильтр по назначенному менеджеру
- `priority` (опционально) - фильтр по приоритету
- `search` (опционально) - поиск по клиенту/сообщениям

**Ответ:**
```json
{
  "data": [
    {
      "id": 1,
      "client": {
        "id": 10,
        "name": "Иван Иванов",
        "email": "ivan@example.com"
      },
      "last_message": {...},
      "unread_count": 3,
      "status": "open",
      "priority": "high",
      "assigned_to": {...},
      "sla_violation": false
    }
  ]
}
```

**Использование:**
- Список всех чатов, назначенных менеджеру
- Фильтрация и поиск

---

### 4.2. Получить сообщения чата
**GET** `/api/manager-client-chats/{chatId}/messages`

**Параметры:**
- `chatId` (обязательно) - ID чата
- `page` (опционально) - пагинация
- `per_page` (опционально) - количество на странице

**Использование:**
- Загрузить историю сообщений конкретного чата

---

### 4.3. Отправить сообщение менеджера
**POST** `/api/manager-client-chats/{chatId}/messages`

**Тело запроса:**
```json
{
  "body": "Текст сообщения",
  "files": [] // опционально
}
```

**Использование:**
- Менеджер отправляет сообщение клиенту

---

### 4.4. Пометить сообщение как прочитанное
**POST** `/api/manager-client-chats/{chatId}/messages/{messageId}/read`

**Использование:**
- Пометить конкретное сообщение как прочитанное

---

### 4.5. Пометить весь чат как прочитанный
**POST** `/api/manager-client-chats/{id}/read`

**Использование:**
- Пометить все сообщения в чате как прочитанные

---

### 4.6. Индикатор набора текста
**POST** `/api/manager-client-chats/{chatId}/typing`

**Тело запроса:**
```json
{
  "is_typing": true
}
```

---

### 4.7. Получить информацию о клиенте
**GET** `/api/manager-client-chats/{id}/client-info`

**Использование:**
- Показать детальную информацию о клиенте в чате

---

### 4.8. Получить заказы клиента
**GET** `/api/manager-client-chats/{id}/client-orders`

**Использование:**
- Показать историю заказов клиента

---

### 4.9. Управление чатом

**Назначить чат менеджеру:**
- **POST** `/api/manager-client-chats/{id}/assign` - назначить другому менеджеру
- **POST** `/api/manager-client-chats/{id}/take` - взять чат себе
- **POST** `/api/manager-client-chats/{id}/unassign` - снять назначение

**Управление статусом:**
- **POST** `/api/manager-client-chats/{id}/close` - закрыть чат
- **POST** `/api/manager-client-chats/{id}/reopen` - открыть чат
- **POST** `/api/manager-client-chats/{id}/defer` - отложить чат
- **POST** `/api/manager-client-chats/{id}/undefer` - убрать из отложенных

**Приоритет:**
- **PUT** `/api/manager-client-chats/{id}/priority` - изменить приоритет

**Тело запроса для приоритета:**
```json
{
  "priority": "low" // или "normal", "high", "urgent"
}
```

---

### 4.10. SLA (Service Level Agreement)

**Получить нарушения SLA:**
- **GET** `/api/manager-client-chats/sla/violations`

**Получить статистику SLA:**
- **GET** `/api/manager-client-chats/sla/stats`

**Игнорировать нарушение SLA:**
- **POST** `/api/manager-client-chats/{id}/ignore-sla`

**Использование:**
- Отслеживание времени ответа на сообщения
- Уведомления о нарушениях SLA

---

### 4.11. Счетчик непрочитанных сообщений
**GET** `/api/manager-client-chats/unread-count`

**Ответ:**
```json
{
  "unread_count": 15
}
```

**Использование:**
- Показать badge с количеством непрочитанных сообщений

---

### 4.12. Конфигурация
**GET** `/api/manager-client-chats/config`

**Использование:**
- Получить настройки чатов (права доступа, статусы и т.д.)

---

## 5. Публичный чат виджета (Website Chat)

### 5.1. Инициализация чата
**POST** `/api/website-chat/init`

**Тело запроса:**
```json
{
  "name": "Имя пользователя",
  "email": "email@example.com",
  "message": "Первое сообщение"
}
```

**Ответ:**
```json
{
  "chat_id": "unique-chat-id",
  "session_id": "session-id"
}
```

**Использование:**
- Создать новый чат для посетителя сайта (публичный доступ)

---

### 5.2. Получить информацию о чате
**GET** `/api/website-chat/{chatId}`

**Использование:**
- Получить информацию о существующем чате

---

### 5.3. Получить сообщения
**GET** `/api/website-chat/{chatId}/messages`

**Использование:**
- Загрузить историю сообщений публичного чата

---

### 5.4. Отправить сообщение
**POST** `/api/website-chat/{chatId}/messages`

**Тело запроса:**
```json
{
  "body": "Текст сообщения"
}
```

---

### 5.5. Загрузить файл
**POST** `/api/website-chat/{chatId}/files`

**Тело запроса (multipart/form-data):**
- `file` (обязательно) - файл для загрузки

**Использование:**
- Загрузка файлов в публичный чат

---

### 5.6. Индикатор набора текста
**POST** `/api/website-chat/{chatId}/typing`

---

## 6. Загрузка файлов

### Общие требования к файлам:

**Для чатов заказов (account/boost):**
- Поддержка множественной загрузки через `files[]`
- Файлы сохраняются в `/storage/chats/`
- Доступ через URL: `/storage/chats/{path}`

**Для тикетов:**
- Один файл через `attachment`
- Разрешенные типы: jpg, jpeg, png, webp, pdf, doc, docx, txt, zip
- Максимальный размер: 10MB

**Для менеджерских чатов:**
- Поддержка множественной загрузки
- Формат: `multipart/form-data`

**Пример загрузки файла (JavaScript/React Native):**
```javascript
const formData = new FormData();
formData.append('order_id', orderId);
formData.append('from_id', userId);
formData.append('to_id', recipientId);
formData.append('body', messageText);
formData.append('files[]', {
  uri: fileUri,
  type: 'image/jpeg',
  name: 'photo.jpg'
});

fetch(`${API_URL}/chat/account/message`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'multipart/form-data'
  },
  body: formData
});
```

---

## 7. WebSocket / Real-time обновления

### Рекомендации по реализации:

1. **Polling (простой вариант):**
   - Использовать `since_id` параметр для получения новых сообщений
   - Опрашивать каждые 2-5 секунд при открытом чате
   - Пример: `GET /api/chats/{orderId}/messages?since_id={lastMessageId}`

2. **WebSocket (рекомендуется):**
   - Использовать Laravel Echo / Pusher для real-time обновлений
   - Каналы:
     - `account.{orderId}` - для чатов аккаунтов
     - `boost.{orderId}` - для чатов бустов
     - `manager-client-chat.{chatId}` - для менеджерских чатов
   - События:
     - `MessageSent` - новое сообщение
     - `UserTyping` - индикатор набора текста
     - `MessageRead` - сообщение прочитано

**Пример подписки (Laravel Echo):**
```javascript
Echo.private(`account.${orderId}`)
  .listen('MessageSent', (e) => {
    // Добавить новое сообщение в UI
  })
  .listen('UserTyping', (e) => {
    // Показать индикатор "Печатает..."
  });
```

---

## 8. Обработка ошибок

### Стандартные коды ответов:

- **200** - Успешный запрос
- **201** - Ресурс создан
- **401** - Не авторизован (нужен токен)
- **403** - Нет доступа
- **422** - Ошибка валидации
- **404** - Ресурс не найден
- **500** - Ошибка сервера

### Формат ошибок:

```json
{
  "error": "Описание ошибки",
  "errors": {
    "field": ["Сообщение об ошибке"]
  }
}
```

### Типичные ошибки:

1. **Пустое сообщение:**
```json
{
  "status": "200",
  "type": "error",
  "message": "Пусте повідомлення"
}
```

2. **Стоп-слова:**
```json
{
  "status": "200",
  "type": "error",
  "message": "Передача особистих даних заборонена"
}
```

3. **Запрещенные ссылки:**
```json
{
  "status": "200",
  "type": "error",
  "message": "Посилання заборонені"
}
```

---

## 9. Рекомендации по реализации

### 9.1. Структура данных в приложении:

```typescript
interface Chat {
  id: number;
  orderId: number;
  client: User;
  lastMessage: Message;
  unreadCount: number;
  status: 'open' | 'closed' | 'deferred';
  priority: 'low' | 'normal' | 'high' | 'urgent';
}

interface Message {
  id: number;
  from: User;
  to: User;
  body: string;
  type: 'message' | 'system';
  createdAt: string;
  seen: boolean;
  files?: File[];
}

interface QuickReply {
  id: number;
  key: string;
  text: string;
  translations: Record<string, string>;
}
```

### 9.2. Основные экраны:

1. **Список чатов:**
   - Загрузка: `GET /api/chats` или `GET /api/manager-client-chats`
   - Обновление: каждые 10-30 секунд или через WebSocket
   - Счетчик непрочитанных: badge на каждом чате

2. **Экран чата:**
   - Загрузка сообщений: `GET /api/chats/{id}/messages`
   - Отправка: `POST /api/chats/{id}/messages`
   - Быстрые ответы: `GET /api/quick-replies`
   - Индикатор набора: `POST /api/chats/{id}/typing`
   - Пометить прочитанным: `POST /api/chats/{id}/mark-seen`

3. **Загрузка файлов:**
   - Выбор файла из галереи/камеры
   - Отправка через `multipart/form-data`
   - Показ прогресса загрузки

### 9.3. Оптимизация:

1. **Кэширование:**
   - Кэшировать список быстрых ответов (обновлять раз в час)
   - Кэшировать список чатов (обновлять при открытии приложения)

2. **Пагинация:**
   - Загружать сообщения порциями (по 50)
   - Использовать infinite scroll для истории

3. **Офлайн режим:**
   - Сохранять отправленные сообщения локально
   - Синхронизировать при восстановлении соединения

4. **Производительность:**
   - Использовать `since_id` вместо полной перезагрузки
   - Дебаунс для индикатора набора текста (3-5 секунд)

---

## 10. Примеры использования

### Пример 1: Открытие чата и загрузка сообщений

```javascript
// 1. Получить список чатов
const chats = await fetch('/api/chats', {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json());

// 2. Выбрать чат и загрузить сообщения
const selectedChat = chats.data[0];
const messages = await fetch(
  `/api/chats/${selectedChat.id}/messages?per_page=50`,
  { headers: { 'Authorization': `Bearer ${token}` } }
).then(r => r.json());

// 3. Загрузить быстрые ответы
const quickReplies = await fetch('/api/quick-replies?locale=ru', {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json());

// 4. Пометить как прочитанные
await fetch(`/api/chats/${selectedChat.id}/mark-seen`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});
```

### Пример 2: Отправка сообщения с быстрым ответом

```javascript
// Пользователь выбрал быстрый ответ
const quickReply = quickReplies.data[0];

// Отправить сообщение
const response = await fetch(`/api/chats/${chatId}/messages`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    body: quickReply.text
  })
});

const newMessage = await response.json();
// Добавить сообщение в UI
```

### Пример 3: Индикатор набора текста

```javascript
let typingTimeout;

const handleTyping = () => {
  // Отправить индикатор
  fetch(`/api/chats/${chatId}/typing`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ is_typing: true })
  });

  // Очистить предыдущий таймер
  clearTimeout(typingTimeout);

  // Через 3 секунды отправить false
  typingTimeout = setTimeout(() => {
    fetch(`/api/chats/${chatId}/typing`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ is_typing: false })
    });
  }, 3000);
};
```

### Пример 4: Загрузка файла

```javascript
const sendMessageWithFile = async (chatId, messageText, fileUri) => {
  const formData = new FormData();
  formData.append('order_id', chatId);
  formData.append('from_id', currentUserId);
  formData.append('to_id', recipientId);
  formData.append('body', messageText);
  
  formData.append('files[]', {
    uri: fileUri,
    type: 'image/jpeg',
    name: 'photo.jpg'
  });

  const response = await fetch('/api/chat/account/message', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'multipart/form-data'
    },
    body: formData
  });

  return response.json();
};
```

---

## 11. Чек-лист для программиста

- [ ] Настроить авторизацию через Sanctum
- [ ] Реализовать получение списка чатов
- [ ] Реализовать загрузку сообщений с пагинацией
- [ ] Реализовать отправку сообщений
- [ ] Реализовать быстрые ответы
- [ ] Реализовать индикатор набора текста
- [ ] Реализовать загрузку файлов
- [ ] Реализовать пометку сообщений как прочитанных
- [ ] Реализовать счетчик непрочитанных сообщений
- [ ] Настроить WebSocket/Polling для real-time обновлений
- [ ] Обработать ошибки (стоп-слова, пустые сообщения, ссылки)
- [ ] Реализовать офлайн режим (опционально)
- [ ] Оптимизировать производительность (кэширование, пагинация)

---

## 12. Дополнительные функции (опционально)

### Уведомления
- **GET** `/api/notifications` - получить уведомления
- **GET** `/api/notifications/unread-count` - счетчик непрочитанных
- **PATCH** `/api/notifications/{id}/read` - пометить как прочитанное

### Стоп-слова
- **GET** `/api/stop-words` - получить список стоп-слов (для админов)

---

## Контакты и поддержка

При возникновении вопросов или проблем с API, обращайтесь к команде разработки.

**Важно:** Все endpoints требуют авторизации через Laravel Sanctum, кроме публичных endpoints Website Chat API.

