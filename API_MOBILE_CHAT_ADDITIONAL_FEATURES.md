# Дополнительные функции Chat API для мобильного приложения

## Содержание

1. [Получение аватара менеджера](#1-получение-аватара-менеджера)
2. [Получение аватаров пользователей (сайт + Telegram)](#2-получение-аватаров-пользователей-сайт--telegram)
3. [Информация о пользователе и текущей странице](#3-информация-о-пользователе-и-текущей-странице)
4. [Список доступных менеджеров для назначения](#4-список-доступных-менеджеров-для-назначения)
5. [Языковые переводы быстрых ответов](#5-языковые-переводы-быстрых-ответов)

---

## 1. Получение аватара менеджера

### Описание
Аватар менеджера можно получить из данных пользователя, который назначен на чат. Аватар возвращается в полях `assignedManager` или `assigned_manager` в ответах API.

### Где получить аватар менеджера:

#### 1.1. В списке менеджерских чатов
**GET** `/api/manager-client-chats`

**Ответ содержит:**
```json
{
  "data": [
    {
      "id": 1,
      "assigned_manager": {
        "id": 5,
        "name": "Иван Менеджер",
        "email": "manager@example.com",
        "avatar": "https://your-domain.com/storage/uploads/avatars/avatar123.jpg"
      }
    }
  ]
}
```

#### 1.2. В детальной информации о чате
**GET** `/api/manager-client-chats/{id}`

**Ответ содержит:**
```json
{
  "id": 1,
  "assigned_manager": {
    "id": 5,
    "name": "Иван Менеджер",
    "email": "manager@example.com",
    "avatar": "https://your-domain.com/storage/uploads/avatars/avatar123.jpg"
  }
}
```

#### 1.3. Формат URL аватара

Аватар всегда возвращается как полный URL:
- Если аватар установлен: `https://your-domain.com/storage/{path_to_avatar}`
- Если аватар не установлен: `https://your-domain.com/storage/upload/avatar/avatar.png` (дефолтный)

**Пример обработки в приложении:**
```javascript
// Получить аватар менеджера
const getManagerAvatar = (chat) => {
  if (chat.assigned_manager?.avatar) {
    return chat.assigned_manager.avatar;
  }
  // Дефолтный аватар
  return 'https://your-domain.com/storage/upload/avatar/avatar.png';
};

// Использование в React Native
<Image 
  source={{ uri: getManagerAvatar(chat) }}
  style={styles.avatar}
  defaultSource={require('./default-avatar.png')}
/>
```

---

## 2. Получение аватаров пользователей (сайт + Telegram)

### Описание
Аватары пользователей, которые пишут в чат, могут приходить из двух источников:
- **Сайт** - аватар пользователя из профиля
- **Telegram** - аватар из Telegram профиля

### 2.1. Аватар клиента в менеджерских чатах

**GET** `/api/manager-client-chats/{id}`

**Ответ содержит поле `client_avatar`:**
```json
{
  "id": 1,
  "source": "website", // или "telegram"
  "client_avatar": "https://your-domain.com/storage/uploads/avatars/user123.jpg",
  "client_user_id": 10,
  "telegram_id": null
}
```

**Логика получения аватара:**
1. Если `source === 'telegram'` и есть `telegram_id`:
   - Аватар получается из Telegram API
   - URL возвращается в поле `client_avatar`
   
2. Если `source === 'website'` и есть `client_user_id`:
   - Аватар пользователя из базы данных
   - Формат: `https://your-domain.com/storage/{user.avatar}`
   - Если аватар не установлен: `https://your-domain.com/storage/upload/avatar/avatar.png`

### 2.2. Аватары в сообщениях

#### Для менеджерских чатов:
**GET** `/api/manager-client-chats/{chatId}/messages`

**Ответ содержит аватары отправителей:**
```json
{
  "data": [
    {
      "id": 123,
      "from": {
        "id": 10,
        "name": "Клиент",
        "avatar": "https://your-domain.com/storage/uploads/avatars/user123.jpg"
      },
      "body": "Текст сообщения"
    }
  ]
}
```

#### Для чатов заказов:
**GET** `/api/chats/{orderId}/messages`

**Ответ:**
```json
{
  "data": [
    {
      "id": 456,
      "from": {
        "id": 1,
        "name": "Иван Иванов",
        "email": "ivan@example.com"
      },
      "body": "Текст сообщения"
    }
  ]
}
```

**Примечание:** В этом endpoint аватар не возвращается напрямую, но можно получить через:
- **GET** `/api/users/{userId}` - получить информацию о пользователе с аватаром

### 2.3. Получение аватара пользователя по ID

**GET** `/api/users/{id}`

**Ответ:**
```json
{
  "id": 10,
  "name": "Иван Иванов",
  "email": "ivan@example.com",
  "avatar": "https://your-domain.com/storage/uploads/avatars/user123.jpg",
  // ... другие поля
}
```

**Использование:**
```javascript
// Получить аватар пользователя
const getUserAvatar = async (userId) => {
  try {
    const response = await fetch(`/api/users/${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const user = await response.json();
    return user.avatar || 'https://your-domain.com/storage/upload/avatar/avatar.png';
  } catch (error) {
    return 'https://your-domain.com/storage/upload/avatar/avatar.png';
  }
};
```

### 2.4. Обработка Telegram аватаров

Для Telegram чатов аватар получается автоматически через Telegram API и возвращается в поле `client_avatar`. Если получение аватара из Telegram не удалось, используется дефолтный аватар.

**Пример обработки:**
```javascript
const getClientAvatar = (chat) => {
  // Аватар уже получен и находится в client_avatar
  if (chat.client_avatar) {
    return chat.client_avatar;
  }
  
  // Дефолтный аватар
  return 'https://your-domain.com/storage/upload/avatar/avatar.png';
};
```

---

## 3. Информация о пользователе и текущей странице

### Описание
API предоставляет информацию о том, на какой странице находится пользователь, какие страницы он посещал, его IP, страну, город и время на сайте.

### 3.1. Получение информации о клиенте

**GET** `/api/manager-client-chats/{id}/client-info`

**Ответ:**
```json
{
  "ip": "192.168.1.1",
  "country": "UA",
  "country_name": "Ukraine",
  "city": "Kyiv",
  "current_page": "/market/products",
  "page_visits": [
    {
      "url": "/market/products",
      "last_active": "2024-01-15 10:30:00"
    },
    {
      "url": "/profile",
      "last_active": "2024-01-15 10:25:00"
    }
  ],
  "total_visits": 2,
  "time_on_site": "15 минут",
  "first_visit": "2024-01-15 10:20:00",
  "last_visit": "2024-01-15 10:30:00"
}
```

### 3.2. Описание полей

| Поле | Тип | Описание |
|------|-----|----------|
| `ip` | string | IP адрес пользователя |
| `country` | string | Код страны (ISO 3166-1 alpha-2) |
| `country_name` | string | Название страны |
| `city` | string | Город пользователя |
| `current_page` | string | Текущая страница, на которой находится пользователь (route или path) |
| `page_visits` | array | Массив посещенных страниц с временем последней активности |
| `total_visits` | integer | Общее количество посещенных страниц |
| `time_on_site` | string | Время, проведенное на сайте (форматированное) |
| `first_visit` | string | Время первого визита |
| `last_visit` | string | Время последнего визита |

### 3.3. Логика получения данных

**Для website чатов:**
- `current_page` получается из `LiveUserTracker` в реальном времени
- `page_visits` получается из таблицы `page_visits` по IP или user_id
- Геолокация определяется по IP через `GeoLocationService`

**Для Telegram чатов:**
- Геолокация может быть недоступна
- `current_page` не доступен (null)
- `page_visits` может быть пустым

**Для авторизованных пользователей сайта:**
- Используются данные из профиля пользователя
- Геолокация может быть из профиля или по IP

### 3.4. Использование в приложении

```javascript
// Получить информацию о клиенте
const getClientInfo = async (chatId) => {
  try {
    const response = await fetch(`/api/manager-client-chats/${chatId}/client-info`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const info = await response.json();
    
    return {
      currentPage: info.current_page || 'Неизвестно',
      country: info.country_name || info.country || 'Неизвестно',
      city: info.city || null,
      timeOnSite: info.time_on_site || '0 минут',
      totalVisits: info.total_visits || 0,
      pageVisits: info.page_visits || []
    };
  } catch (error) {
    console.error('Failed to get client info:', error);
    return null;
  }
};

// Отобразить информацию
const ClientInfoCard = ({ chatId }) => {
  const [info, setInfo] = useState(null);
  
  useEffect(() => {
    getClientInfo(chatId).then(setInfo);
  }, [chatId]);
  
  if (!info) return <Loading />;
  
  return (
    <View>
      <Text>Текущая страница: {info.currentPage}</Text>
      <Text>Страна: {info.country}</Text>
      {info.city && <Text>Город: {info.city}</Text>}
      <Text>Время на сайте: {info.timeOnSite}</Text>
      <Text>Посещений: {info.totalVisits}</Text>
      
      {/* История посещений */}
      {info.pageVisits.length > 0 && (
        <View>
          <Text>Посещенные страницы:</Text>
          {info.pageVisits.map((visit, index) => (
            <Text key={index}>
              {visit.url} - {visit.last_active}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
};
```

### 3.5. Обновление информации в реальном времени

Информация о `current_page` обновляется в реальном времени через `LiveUserTracker`. Для получения актуальных данных рекомендуется:

1. **Polling** - опрашивать endpoint каждые 10-30 секунд
2. **WebSocket** - подписаться на события обновления (если реализовано)

```javascript
// Polling для обновления текущей страницы
useEffect(() => {
  const interval = setInterval(async () => {
    const info = await getClientInfo(chatId);
    setInfo(info);
  }, 15000); // Каждые 15 секунд
  
  return () => clearInterval(interval);
}, [chatId]);
```

---

## 4. Список доступных менеджеров для назначения

### Описание
При назначении менеджера на чат необходимо получить список всех доступных менеджеров.

### 4.1. Получение списка менеджеров

**GET** `/api/manager-kpi/managers`

**Требования:**
- Авторизация через Sanctum
- Права доступа (только для админов/менеджеров)

**Ответ:**
```json
[
  {
    "id": 5,
    "name": "Иван Менеджер",
    "email": "ivan.manager@example.com"
  },
  {
    "id": 6,
    "name": "Петр Менеджер",
    "email": "petr.manager@example.com"
  }
]
```

**Примечание:** Менеджеры определяются по `role_id = 6`.

### 4.2. Получение полной информации о менеджерах

Если нужна дополнительная информация (аватар, статус онлайн и т.д.), можно получить каждого менеджера отдельно:

**GET** `/api/users/{id}`

**Ответ:**
```json
{
  "id": 5,
  "name": "Иван Менеджер",
  "email": "ivan.manager@example.com",
  "avatar": "https://your-domain.com/storage/uploads/avatars/manager123.jpg",
  "is_online": true,
  "last_seen_at": "2024-01-15 10:30:00",
  "role_id": 6,
  // ... другие поля
}
```

### 4.3. Использование в приложении

```javascript
// Получить список менеджеров
const getAvailableManagers = async () => {
  try {
    const response = await fetch('/api/manager-kpi/managers', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const managers = await response.json();
    
    // Опционально: получить полную информацию с аватарами
    const managersWithAvatars = await Promise.all(
      managers.map(async (manager) => {
        const userResponse = await fetch(`/api/users/${manager.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const userData = await userResponse.json();
        return {
          ...manager,
          avatar: userData.avatar,
          is_online: userData.is_online,
          last_seen_at: userData.last_seen_at
        };
      })
    );
    
    return managersWithAvatars;
  } catch (error) {
    console.error('Failed to get managers:', error);
    return [];
  }
};

// Компонент выбора менеджера
const ManagerSelector = ({ chatId, onAssign }) => {
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    getAvailableManagers().then(managers => {
      setManagers(managers);
      setLoading(false);
    });
  }, []);
  
  const handleAssign = async (managerId) => {
    try {
      const response = await fetch(`/api/manager-client-chats/${chatId}/assign`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          manager_id: managerId,
          type: 'manual'
        })
      });
      
      if (response.ok) {
        onAssign(managerId);
      }
    } catch (error) {
      console.error('Failed to assign manager:', error);
    }
  };
  
  if (loading) return <Loading />;
  
  return (
    <View>
      <Text>Выберите менеджера:</Text>
      {managers.map(manager => (
        <TouchableOpacity 
          key={manager.id}
          onPress={() => handleAssign(manager.id)}
        >
          <Image source={{ uri: manager.avatar }} />
          <Text>{manager.name}</Text>
          {manager.is_online && <Text>Онлайн</Text>}
        </TouchableOpacity>
      ))}
    </View>
  );
};
```

### 4.4. Назначение менеджера

**POST** `/api/manager-client-chats/{id}/assign`

**Тело запроса:**
```json
{
  "manager_id": 5,
  "type": "manual" // или "auto"
}
```

**Ответ:**
```json
{
  "success": true,
  "chat": {
    "id": 1,
    "assigned_manager_id": 5,
    "assigned_manager": {
      "id": 5,
      "name": "Иван Менеджер",
      "avatar": "..."
    }
  }
}
```

---

## 5. Языковые переводы быстрых ответов

### Описание
Быстрые ответы поддерживают многоязычность. Можно получить переводы на разных языках или текст на конкретном языке.

### 5.1. Получение быстрых ответов с переводами

**GET** `/api/quick-replies?locale={locale}`

**Параметры:**
- `locale` (опционально) - код языка (ua, ru, en, pl, it, fr, es, de и т.д.)
  - По умолчанию используется язык приложения

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
        "en": "Hello! How can I help?",
        "pl": "Cześć! Jak mogę pomóc?",
        "it": "Ciao! Come posso aiutare?",
        "fr": "Bonjour! Comment puis-je vous aider?",
        "es": "¡Hola! ¿Cómo puedo ayudar?",
        "de": "Hallo! Wie kann ich helfen?"
      },
      "order": 0,
      "active": true
    },
    {
      "id": 2,
      "key": "thanks",
      "text": "Спасибо за обращение!",
      "translations": {
        "ua": "Дякую за звернення!",
        "ru": "Спасибо за обращение!",
        "en": "Thank you for contacting us!",
        "pl": "Dziękujemy za kontakt!",
        // ... другие языки
      },
      "order": 1,
      "active": true
    }
  ]
}
```

### 5.2. Структура ответа

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | integer | ID быстрого ответа |
| `key` | string | Уникальный ключ ответа |
| `text` | string | Текст на языке, указанном в `locale` (или языке по умолчанию) |
| `translations` | object | Объект с переводами на все доступные языки |
| `order` | integer | Порядок сортировки |
| `active` | boolean | Активен ли быстрый ответ |

### 5.3. Использование в приложении

#### 5.3.1. Получение ответов на языке пользователя

```javascript
// Получить быстрые ответы на языке пользователя
const getQuickReplies = async (userLocale = 'ru') => {
  try {
    const response = await fetch(`/api/quick-replies?locale=${userLocale}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    
    // data.data содержит массив быстрых ответов
    // Каждый ответ уже содержит text на нужном языке
    return data.data;
  } catch (error) {
    console.error('Failed to get quick replies:', error);
    return [];
  }
};

// Использование
const QuickRepliesList = () => {
  const [replies, setReplies] = useState([]);
  const userLocale = getUserLocale(); // Получить язык из настроек приложения
  
  useEffect(() => {
    getQuickReplies(userLocale).then(setReplies);
  }, [userLocale]);
  
  return (
    <View>
      {replies.map(reply => (
        <TouchableOpacity 
          key={reply.id}
          onPress={() => sendMessage(reply.text)}
        >
          <Text>{reply.text}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};
```

#### 5.3.2. Работа с переводами напрямую

Если нужно переключать язык в приложении без повторного запроса:

```javascript
// Получить все переводы
const getQuickRepliesWithTranslations = async () => {
  const response = await fetch('/api/quick-replies', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  return data.data; // Содержит translations для всех языков
};

// Использование переводов
const QuickRepliesList = ({ currentLocale }) => {
  const [replies, setReplies] = useState([]);
  
  useEffect(() => {
    getQuickRepliesWithTranslations().then(setReplies);
  }, []);
  
  // Получить текст на текущем языке
  const getText = (reply, locale) => {
    return reply.translations[locale] || reply.translations['ru'] || reply.text;
  };
  
  return (
    <View>
      {replies.map(reply => (
        <TouchableOpacity 
          key={reply.id}
          onPress={() => sendMessage(getText(reply, currentLocale))}
        >
          <Text>{getText(reply, currentLocale)}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};
```

#### 5.3.3. Кэширование переводов

Рекомендуется кэшировать быстрые ответы, так как они редко меняются:

```javascript
// Кэширование с проверкой обновлений
class QuickRepliesCache {
  constructor() {
    this.cache = null;
    this.lastUpdate = null;
    this.cacheDuration = 3600000; // 1 час
  }
  
  async getReplies(locale = 'ru', forceRefresh = false) {
    const now = Date.now();
    
    // Проверяем, нужно ли обновить кэш
    if (!this.cache || forceRefresh || 
        !this.lastUpdate || 
        (now - this.lastUpdate) > this.cacheDuration) {
      
      const response = await fetch(`/api/quick-replies?locale=${locale}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      this.cache = data.data;
      this.lastUpdate = now;
    }
    
    return this.cache;
  }
  
  // Получить текст на конкретном языке из кэша
  getText(replyId, locale) {
    if (!this.cache) return null;
    
    const reply = this.cache.find(r => r.id === replyId);
    if (!reply) return null;
    
    return reply.translations[locale] || reply.translations['ru'] || reply.text;
  }
}

// Использование
const quickRepliesCache = new QuickRepliesCache();

// При загрузке приложения
await quickRepliesCache.getReplies('ru');

// При смене языка
await quickRepliesCache.getReplies('en', true); // forceRefresh = true
```

### 5.4. Поддерживаемые языки

Поддерживаемые коды языков (могут отличаться в зависимости от настроек):
- `ua` - Украинский
- `ru` - Русский
- `en` - Английский
- `pl` - Польский
- `it` - Итальянский
- `fr` - Французский
- `es` - Испанский
- `de` - Немецкий

**Примечание:** Если перевод на запрошенный язык отсутствует, используется перевод на русский (`ru`), а если и его нет - первый доступный перевод.

### 5.5. Пример полной реализации

```javascript
// Хук для работы с быстрыми ответами
const useQuickReplies = (locale = 'ru') => {
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchReplies = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/quick-replies?locale=${locale}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch quick replies');
        }
        
        const data = await response.json();
        setReplies(data.data.filter(reply => reply.active)); // Только активные
        setError(null);
      } catch (err) {
        setError(err.message);
        console.error('Quick replies error:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchReplies();
  }, [locale]);
  
  const getText = (replyId, customLocale = null) => {
    const reply = replies.find(r => r.id === replyId);
    if (!reply) return null;
    
    const targetLocale = customLocale || locale;
    return reply.translations[targetLocale] || 
           reply.translations['ru'] || 
           reply.text;
  };
  
  return {
    replies,
    loading,
    error,
    getText,
    refresh: () => {
      // Принудительное обновление
      setLoading(true);
      // useEffect автоматически перезагрузит данные
    }
  };
};

// Использование в компоненте
const ChatQuickReplies = ({ onSelectReply }) => {
  const locale = useLocale(); // Хук для получения языка пользователя
  const { replies, loading, getText } = useQuickReplies(locale);
  
  if (loading) return <Loading />;
  
  return (
    <ScrollView horizontal>
      {replies.map(reply => (
        <TouchableOpacity
          key={reply.id}
          onPress={() => onSelectReply(getText(reply.id))}
          style={styles.quickReplyButton}
        >
          <Text>{getText(reply.id)}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};
```

---

## Резюме

### Быстрый справочник endpoints:

1. **Аватар менеджера:**
   - `GET /api/manager-client-chats/{id}` → `assigned_manager.avatar`

2. **Аватар клиента:**
   - `GET /api/manager-client-chats/{id}` → `client_avatar`
   - `GET /api/users/{id}` → `avatar`

3. **Информация о пользователе:**
   - `GET /api/manager-client-chats/{id}/client-info` → полная информация

4. **Список менеджеров:**
   - `GET /api/manager-kpi/managers` → список менеджеров
   - `GET /api/users/{id}` → детальная информация о менеджере

5. **Переводы быстрых ответов:**
   - `GET /api/quick-replies?locale={locale}` → быстрые ответы на нужном языке

---

## Дополнительные рекомендации

1. **Кэширование:** Кэшируйте аватары и быстрые ответы для улучшения производительности
2. **Обработка ошибок:** Всегда обрабатывайте случаи, когда аватар недоступен (используйте дефолтный)
3. **Оптимизация:** Для списка менеджеров можно загружать аватары лениво (по требованию)
4. **Обновления:** Используйте polling или WebSocket для обновления информации о текущей странице пользователя
5. **Локализация:** Сохраняйте выбранный язык пользователя и используйте его для быстрых ответов

