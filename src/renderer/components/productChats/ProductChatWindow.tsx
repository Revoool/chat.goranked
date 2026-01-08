import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import MessageList from '../chat/MessageList';
import '../../styles/ChatWindow.css';

interface ProductChatWindowProps {
  orderId: number;
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

  // Загружаем данные чата заказа маркетплейса
  const { data: messagesData, isLoading: messagesLoading, error: messagesError, refetch } = useQuery({
    queryKey: ['product-chat-messages', orderId],
    queryFn: async () => {
      // Автоматически помечаем как прочитанные при загрузке
      const data = await apiClient.getProductChatMessages(orderId, { mark_seen: true });
      // Также вызываем markSeen для гарантии
      await apiClient.markProductChatSeen(orderId).catch(err => {
        console.warn('Failed to mark product order chat as seen:', err);
      });
      return data;
    },
    enabled: !!orderId,
    refetchInterval: 5000, // Refetch every 5 seconds
  });

  const thread = messagesData?.thread;
  const messages = messagesData?.data || [];

  // Автоматически помечаем как прочитанные при открытии чата
  useEffect(() => {
    if (orderId) {
      apiClient.markProductChatSeen(orderId).catch(err => {
        console.warn('Failed to mark product order chat as seen:', err);
      });
    }
  }, [orderId]);

  // Проверяем, есть ли продавец
  const hasSeller = useMemo(() => {
    // Для product orders нужно проверить product.user_id
    return !!(thread?.product?.user_id && thread?.product?.user_id !== thread?.user?.id);
  }, [thread]);

  // Отправка сообщения
  const sendMessageMutation = useMutation({
    mutationFn: async (body: string) => {
      if (sendAsAdmin) {
        // Отправляем от админа
        return apiClient.sendProductChatMessage(orderId, body);
      } else {
        // Отправляем от продавца
        if (!thread?.product?.user_id) {
          throw new Error('Seller ID not found');
        }
        if (!thread?.user?.id) {
          throw new Error('Client ID not found');
        }
        // Используем существующий API для отправки от продавца
        const formData = new FormData();
        formData.append('order_id', orderId.toString());
        formData.append('body', body);
        // Используем существующий метод для отправки сообщения от продавца
        // Для product orders используется тот же API endpoint, что и для account orders
        return apiClient.sendOrderChatMessageAsSeller(
          orderId,
          body,
          thread.product.user_id,
          thread.user.id
        );
      }
    },
    onSuccess: () => {
      setMessageText('');
      setIsTyping(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      refetch();
      queryClient.invalidateQueries({ queryKey: ['product-chats'] });
    },
    onError: (error: any) => {
      console.error('Error sending message:', error);
      alert(`Помилка відправки повідомлення: ${error.response?.data?.message || error.message || 'Невідома помилка'}`);
    },
  });

  // Отправка индикатора печати
  const sendTypingIndicator = async (isCurrentlyTyping: boolean) => {
    if (!currentUser?.id || !orderId) return;

    try {
      await apiClient.sendProductChatTyping(orderId, isCurrentlyTyping);
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
  const formattedMessages = messages.map((msg: any) => ({
    id: msg.id,
    chat_id: orderId,
    from_manager: msg.from_id === (sendAsAdmin ? currentUser?.id : thread.product?.user_id),
    user_id: msg.from_id,
    body: msg.body,
    type: msg.type || 'text',
    seen: msg.seen || false,
    created_at: msg.created_at,
    updated_at: msg.updated_at,
    user: msg.from ? {
      id: msg.from.id,
      name: msg.from.name,
      email: msg.from.email,
      avatar: msg.from.avatar,
    } : null,
    files: msg.files || [],
  }));

  return (
    <div className="chat-window">
      <div className="chat-window-header">
        <div className="chat-window-header-info">
          <h3>{thread.product?.name || `Замовлення #${orderId}`}</h3>
          <div className="chat-window-header-meta">
            <span>ID: {orderId}</span>
            {thread.game && <span>• {thread.game.name}</span>}
            {thread.user && <span>• Клієнт: {thread.user.name}</span>}
          </div>
        </div>
      </div>

      <div className="chat-window-messages">
        <MessageList messages={formattedMessages} searchQuery={searchQuery} />
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
