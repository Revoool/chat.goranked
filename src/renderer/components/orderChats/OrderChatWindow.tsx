import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { OrderChatMessage, OrderChatThread } from '../../types';
import MessageList from '../chat/MessageList';
import '../../styles/ChatWindow.css';

interface OrderChatWindowProps {
  orderId: number;
}

const OrderChatWindow: React.FC<OrderChatWindowProps> = ({ orderId }) => {
  const { searchQuery } = useChatStore();
  const { user: currentUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [messageText, setMessageText] = useState('');
  const [sendAsAdmin, setSendAsAdmin] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Загружаем данные чата заказа
  const { data: messagesData, isLoading: messagesLoading, error: messagesError, refetch } = useQuery({
    queryKey: ['order-chat-messages', orderId],
    queryFn: () => apiClient.getOrderChatMessages(orderId, { mark_seen: true }),
    enabled: !!orderId,
    refetchInterval: 5000, // Refetch every 5 seconds
  });

  const thread = messagesData?.thread;
  const messages = messagesData?.data || [];

  // Проверяем, есть ли продавец
  const hasSeller = useMemo(() => {
    // Для account orders нужно проверить product.user_id
    // Пока используем простую проверку - если есть booster, значит это boost order
    // Для account orders нужно будет получать информацию о продукте отдельно
    return false; // TODO: получить информацию о продавце из API
  }, [thread]);

  // Отправка сообщения
  const sendMessageMutation = useMutation({
    mutationFn: async (body: string) => {
      if (sendAsAdmin) {
        // Отправляем от админа
        return apiClient.sendOrderChatMessage(orderId, body);
      } else {
        // Отправляем от продавца
        if (!thread?.user?.id) {
          throw new Error('Client ID not found');
        }
        // TODO: получить seller_id из API
        // Пока используем текущего пользователя как продавца
        const sellerId = currentUser?.id;
        if (!sellerId) {
          throw new Error('Seller ID not found');
        }
        return apiClient.sendOrderChatMessageAsSeller(
          orderId,
          body,
          sellerId,
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
      queryClient.invalidateQueries({ queryKey: ['order-chats'] });
    },
    onError: (error: any) => {
      console.error('Error sending message:', error);
      alert(`Помилка відправки повідомлення: ${error.response?.data?.message || error.message || 'Невідома помилка'}`);
    },
  });

  // Отправка индикатора печати
  const sendTypingIndicator = async (typing: boolean) => {
    try {
      await apiClient.sendOrderChatTyping(orderId, typing, 'boost');
    } catch (error) {
      console.warn('Failed to send typing indicator:', error);
    }
  };

  // Обработка ввода текста
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageText(e.target.value);
    
    if (!isTyping) {
      setIsTyping(true);
      sendTypingIndicator(true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      sendTypingIndicator(false);
      typingTimeoutRef.current = null;
    }, 3000);
  };

  // Отправка сообщения
  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    sendMessageMutation.mutate(messageText.trim());
  };

  // Прокрутка вниз при новых сообщениях
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Очистка при размонтировании
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

  // Преобразуем сообщения в формат для MessageList
  const formattedMessages = useMemo(() => {
    return messages.map((msg: OrderChatMessage) => ({
      id: msg.id,
      chat_id: msg.order_id,
      from_manager: msg.from_id === currentUser?.id || (thread && msg.from_id !== thread.user?.id),
      user_id: msg.from_id,
      body: msg.body,
      type: msg.type || 'text',
      seen: msg.seen_admin || msg.seen || false,
      delivered: true,
      created_at: msg.created_at,
      updated_at: msg.updated_at,
      user: msg.from ? {
        id: msg.from.id,
        name: msg.from.name,
        email: msg.from.email,
      } : undefined,
      files: msg.files || [],
    }));
  }, [messages, currentUser, thread]);

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

  const clientName = thread?.user?.name || thread?.client_name || 'Unknown';
  const gameName = thread?.game?.name || thread?.game?.alter_name || 'Unknown';

  return (
    <div className="chat-window">
      <div className="chat-window-header">
        <div className="chat-window-header-info">
          <h3>Заказ #{orderId}</h3>
          <div className="chat-window-header-meta">
            <span>{clientName}</span>
            <span>•</span>
            <span>{gameName}</span>
          </div>
        </div>
      </div>

      <div className="chat-window-messages">
        <MessageList 
          messages={formattedMessages} 
          searchQuery={searchQuery}
          chatId={orderId}
        />
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-window-input-container">
        {hasSeller && (
          <div className="order-chat-sender-toggle">
            <button
              type="button"
              className={`sender-toggle-btn ${sendAsAdmin ? 'active' : ''}`}
              onClick={() => setSendAsAdmin(true)}
            >
              Від Адміна
            </button>
            <button
              type="button"
              className={`sender-toggle-btn ${!sendAsAdmin ? 'active' : ''}`}
              onClick={() => setSendAsAdmin(false)}
            >
              Від Продавця
            </button>
          </div>
        )}
        <form onSubmit={handleSend} className="chat-window-input-form">
          <textarea
            value={messageText}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
            placeholder="Повідомлення..."
            className="chat-window-textarea"
            rows={1}
            disabled={sendMessageMutation.isPending}
          />
          <button
            type="submit"
            className="chat-window-send-btn"
            disabled={!messageText.trim() || sendMessageMutation.isPending}
          >
            {sendMessageMutation.isPending ? '...' : 'Відправити'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default OrderChatWindow;
