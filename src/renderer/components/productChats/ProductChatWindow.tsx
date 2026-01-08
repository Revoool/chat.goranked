import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import MessageList from '../chat/MessageList';
import '../../styles/ChatWindow.css';

interface ProductChatWindowProps {
  orderId: string | number; // Может быть строкой вида "productId_buyerId" для ProductInquiry
}

const ProductChatWindow: React.FC<ProductChatWindowProps> = ({ orderId }) => {
  const { searchQuery } = useChatStore();
  const { user: currentUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [messageText, setMessageText] = useState('');
  const [sendAsAdmin, setSendAsAdmin] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Парсим orderId: если это строка вида "productId_buyerId", разбиваем на части
  const chatId = typeof orderId === 'string' ? orderId : String(orderId);
  const [productId, buyerId] = chatId.includes('_') 
    ? chatId.split('_').map(Number)
    : [Number(chatId), null];

  // Загружаем данные чата по вопросам к товарам (ProductInquiry)
  const { data: messagesData, isLoading: messagesLoading, error: messagesError, refetch } = useQuery({
    queryKey: ['product-inquiry-chat-messages', productId, buyerId],
    queryFn: async () => {
      if (!buyerId) {
        throw new Error('Buyer ID is required for product inquiry chat');
      }
      // Загружаем данные чата по вопросам к товарам
      const data = await apiClient.getProductInquiryChatMessages(productId, buyerId, { mark_seen: false });
      // Помечаем как прочитанные после успешной загрузки
      if (data && data.data && data.data.length > 0) {
        await apiClient.markProductInquiryChatSeen(productId).catch(err => {
          console.warn('Failed to mark product inquiry chat as seen:', err);
        });
      }
      return data;
    },
    enabled: !!productId && !!buyerId,
    refetchInterval: 5000, // Refetch every 5 seconds
    staleTime: 0, // Всегда считать данные устаревшими для немедленного обновления
    gcTime: 0, // Не кешировать данные, чтобы при переключении чата всегда загружались свежие данные
  });

  const thread = messagesData?.thread;
  const messages = messagesData?.data || [];

  // Автоматически помечаем как прочитанные при открытии чата
  useEffect(() => {
    if (productId && buyerId) {
      apiClient.markProductInquiryChatSeen(productId).catch(err => {
        console.warn('Failed to mark product inquiry chat as seen:', err);
      });
    }
  }, [productId, buyerId]);

  // Проверяем, есть ли продавец
  const hasSeller = useMemo(() => {
    // Для product inquiry нужно проверить seller
    return !!(thread?.seller?.id && thread?.seller?.id !== thread?.buyer?.id);
  }, [thread]);

  // Отправка сообщения
  const sendMessageMutation = useMutation({
    mutationFn: async (body: string) => {
      if (!currentUser?.id || !thread || !productId) {
        throw new Error('User not authenticated or thread data missing');
      }

      // Определяем toId (кому отправляем)
      const toId = sendAsAdmin 
        ? (thread.buyer?.id || buyerId || null)
        : (thread.buyer?.id || buyerId || null);

      if (!toId) {
        throw new Error('Recipient ID not found');
      }

      // Отправляем сообщение
      return apiClient.sendProductInquiryChatMessage(
        productId,
        body,
        toId
      );
    },
    onSuccess: () => {
      setMessageText('');
      setIsTyping(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      refetch();
      queryClient.invalidateQueries({ queryKey: ['product-inquiry-chats'] });
    },
    onError: (error: any) => {
      console.error('Error sending message:', error);
      alert(`Помилка відправки повідомлення: ${error.response?.data?.message || error.message || 'Невідома помилка'}`);
    },
  });

  // Отправка индикатора печати
  const sendTypingIndicator = async (isCurrentlyTyping: boolean) => {
    if (!currentUser?.id || !productId) return;

    try {
      await apiClient.sendProductInquiryChatTyping(productId, isCurrentlyTyping);
    } catch (error) {
      console.error('Failed to send typing indicator:', error);
    }
  };

  // Обработка ввода текста
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageText(e.target.value);

    // Отправляем индикатор печати
    if (!isTyping) {
      setIsTyping(true);
      sendTypingIndicator(true);
    }

    // Сбрасываем таймер
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Останавливаем индикатор печати через 2 секунды бездействия
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      sendTypingIndicator(false);
      typingTimeoutRef.current = null;
    }, 2000);
  };

  // Отправка сообщения
  const handleSendMessage = () => {
    if (!messageText.trim() || sendMessageMutation.isPending) return;

    sendMessageMutation.mutate(messageText.trim());
  };

  // Обработка Enter
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Прокрутка вниз при новых сообщениях
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  // Очистка таймера при размонтировании
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTyping) {
        sendTypingIndicator(false);
      }
    };
  }, []);

  if (messagesLoading) {
    return (
      <div className="chat-window">
        <div className="chat-window-loading">Загрузка чата...</div>
      </div>
    );
  }

  if (messagesError) {
    return (
      <div className="chat-window">
        <div className="chat-window-error">
          Ошибка загрузки чата. Проверьте консоль.
        </div>
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="chat-window">
        <div className="chat-window-error">Информация о заказе не найдена</div>
      </div>
    );
  }

  // Преобразуем сообщения для MessageList
  const formattedMessages = messages.map((msg: any) => {
    // Определяем, от кого сообщение:
    // - Покупатель: from_id === thread.buyer.id
    // - Продавец: from_id === thread.seller.id
    // - Админ: все остальные
    const isFromBuyer = thread?.buyer?.id && msg.from_id === thread.buyer.id;
    const isFromSeller = thread?.seller?.id && msg.from_id === thread.seller.id;
    const isFromManager = !isFromBuyer; // Админ или продавец = менеджер (не покупатель)
    
    // Получаем данные пользователя из msg.from или создаем из доступных данных
    let userData = msg.from;
    if (!userData && msg.from_id) {
      // Если нет данных пользователя, создаем базовые
      userData = {
        id: msg.from_id,
        name: msg.email || (isFromBuyer ? thread?.buyer?.name : (isFromSeller ? thread?.seller?.name : 'Админ')) || 'Unknown',
        email: msg.email || '',
        avatar: msg.avatar || (isFromBuyer ? thread?.buyer?.avatar : (isFromSeller ? thread?.seller?.avatar : null)),
      };
    }
    
    return {
      id: msg.id,
      chat_id: chatId,
      from_manager: isFromManager,
      user_id: msg.from_id,
      body: msg.body,
      type: msg.type || 'text',
      seen: msg.seen || false,
      created_at: msg.created_at,
      updated_at: msg.updated_at || msg.created_at,
      user: userData,
      files: msg.files || [],
    };
  });

  return (
    <div className="chat-window">
      <div className="chat-window-header">
        <div className="chat-window-header-info">
          <h3>{thread.product?.name || thread.name || `Товар #${productId}`}</h3>
          <div className="chat-window-header-meta">
            {thread.game && <span>{thread.game.name}</span>}
            {thread.buyer && <span>• Покупець: {thread.buyer.name}</span>}
            {thread.seller && <span>• Продавець: {thread.seller.name}</span>}
          </div>
        </div>
      </div>

      <div className="chat-window-messages">
        <MessageList messages={formattedMessages} chatId={chatId} searchQuery={searchQuery} />
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-window-input-container">
        {hasSeller && (
          <div className="order-chat-sender-toggle">
            <button
              className={`sender-toggle-btn ${sendAsAdmin ? 'active' : ''}`}
              onClick={() => setSendAsAdmin(true)}
            >
              Від Адміна
            </button>
            <button
              className={`sender-toggle-btn ${!sendAsAdmin ? 'active' : ''}`}
              onClick={() => setSendAsAdmin(false)}
            >
              Від Продавця
            </button>
          </div>
        )}

        <form
          className="chat-window-input-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
        >
          <textarea
            className="chat-window-textarea"
            value={messageText}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder="Введіть повідомлення..."
            rows={1}
            disabled={sendMessageMutation.isPending}
          />
          <button
            type="submit"
            className="chat-window-send-btn"
            disabled={!messageText.trim() || sendMessageMutation.isPending}
          >
            {sendMessageMutation.isPending ? 'Відправка...' : 'Відправити'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ProductChatWindow;
