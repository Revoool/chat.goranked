import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { OrderChatMessage, OrderChatThread } from '../../types';
import MessageList from '../chat/MessageList';
import AiSuggestions from '../chat/AiSuggestions';
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
  const [showAiSuggestions, setShowAiSuggestions] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Загружаем данные чата заказа маркетплейса
  const { data: messagesData, isLoading: messagesLoading, error: messagesError, refetch } = useQuery({
    queryKey: ['order-chat-messages', orderId],
    queryFn: async () => {
      // Загружаем данные чата заказа маркетплейса
      const data = await apiClient.getProductChatMessages(orderId, { mark_seen: false });
      // Помечаем как прочитанные после успешной загрузки
      if (data && data.data && data.data.length > 0) {
        await apiClient.markProductChatSeen(orderId).catch(err => {
          console.warn('Failed to mark product order chat as seen:', err);
        });
      }
      return data;
    },
    enabled: !!orderId,
    refetchInterval: 5000, // Refetch every 5 seconds
    staleTime: 0, // Всегда считать данные устаревшими для немедленного обновления
    gcTime: 0, // Не кешировать данные, чтобы при переключении чата всегда загружались свежие данные
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
    // Для account orders нужно проверить product.user_id
    // Пока используем простую проверку - если есть booster, значит это boost order
    // Для account orders нужно будет получать информацию о продукте отдельно
    return false; // TODO: получить информацию о продавце из API
  }, [thread]);

  // Отправка сообщения
  const sendMessageMutation = useMutation({
    mutationFn: async (body: string) => {
      // Для заказов маркетплейса определяем fromId и toId
      const fromId = sendAsAdmin 
        ? (currentUser?.id || 0)
        : (thread?.product?.user_id || thread?.seller?.id || currentUser?.id || 0);
      const toId = sendAsAdmin 
        ? (thread?.user?.id || thread?.product?.user_id || undefined)
        : (thread?.user?.id || undefined);
      
      return apiClient.sendProductChatMessage(orderId, body, fromId, toId);
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
      await apiClient.sendProductChatTyping(orderId, typing);
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

      {showAiSuggestions && (
        <AiSuggestions
          chatId={orderId}
          chatType="product-order"
          onSelect={(suggestion: string, index: number, aiRunId?: number) => {
            setMessageText(suggestion);
            setShowAiSuggestions(false);
            // Можно сохранить feedback, что использовали AI предложение
            if (aiRunId) {
              apiClient.saveProductOrderAiFeedback(orderId, {
                ai_run_id: aiRunId,
                selected_candidate_index: index + 1,
                final_sent_content: suggestion,
                was_edited: false,
              }).catch(err => console.warn('Failed to save AI feedback:', err));
            }
          }}
          onClose={() => setShowAiSuggestions(false)}
        />
      )}
      <div className="chat-window-input-container">
        <form onSubmit={handleSend} className="chat-window-input-form">
          {hasSeller && (
            <div className="order-chat-sender-toggle-inline">
              <button
                type="button"
                className={`sender-toggle-btn-inline ${sendAsAdmin ? 'active' : ''}`}
                onClick={() => setSendAsAdmin(true)}
                title="Від Адміна"
              >
                Адмін
              </button>
              <button
                type="button"
                className={`sender-toggle-btn-inline ${!sendAsAdmin ? 'active' : ''}`}
                onClick={() => setSendAsAdmin(false)}
                title="Від Продавця"
              >
                Продавець
              </button>
            </div>
          )}
          <button
            type="button"
            className={`message-input-ai-btn ${showAiSuggestions ? 'active' : ''}`}
            onClick={() => setShowAiSuggestions(!showAiSuggestions)}
            title="AI-предложения ответов"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M12 2L2 7L12 12L22 7L12 2Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              <path
                d="M2 17L12 22L22 17"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              <path
                d="M2 12L12 17L22 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </button>
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
            title={sendAsAdmin ? 'Відправити від Адміна' : 'Відправити від Продавця'}
          >
            {sendMessageMutation.isPending ? '...' : 'Відправити'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default OrderChatWindow;
