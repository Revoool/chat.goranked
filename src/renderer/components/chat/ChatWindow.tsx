import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { useChatStore } from '../../store/chatStore';
import { isMobile } from '../../utils/platform';
import { wsClient } from '../../api/websocket';
import { useAuthStore } from '../../store/authStore';
import { 
  IconInfoCircle, 
  IconUserPlus, 
  IconCircleCheck, 
  IconTags, 
  IconShoppingCart,
  IconX,
  IconFlag,
  IconFlag2,
  IconFlag3,
  IconFlagOff,
  IconNotes,
  IconArrowLeft,
  IconLanguage,
} from '../../icons';
import type { Message } from '../../types';
import { useTranslationStore } from '../../store/translationStore';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import AssignModal from './modals/AssignModal';
import StatusModal from './modals/StatusModal';
import TagsModal from './modals/TagsModal';
import PriorityModal from './modals/PriorityModal';
import ClientOrdersModal from './modals/ClientOrdersModal';
import NoteModal from './modals/NoteModal';
import IconButton from '../common/IconButton';
import '../../styles/ChatWindow.css';

interface ChatWindowProps {
  chatId: number;
}

/** Останні N повідомлень у запит перекладу (вартість/затримка; API макс. 100 id). */
const TRANSLATE_MESSAGE_WINDOW = 80;

const ChatWindow: React.FC<ChatWindowProps> = ({ chatId }) => {
  const [translateLoading, setTranslateLoading] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const translateReqRef = useRef(false);
  const chatIdRef = useRef(chatId);
  const [sendError, setSendError] = useState<{ message: string; retryVars: any | null } | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showTagsModal, setShowTagsModal] = useState(false);
  const [showPriorityModal, setShowPriorityModal] = useState(false);
  const [showClientOrdersModal, setShowClientOrdersModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const { updateChat, chats, toggleClientCard, isClientCardOpen, searchQuery, setSelectedChat } = useChatStore();
  const queryClient = useQueryClient();

  // Try to get chat from store first
  // Мемоизируем поиск чата, чтобы избежать лишних ререндеров
  const chatFromStore = React.useMemo(() => {
    return chats.find(c => c.id === chatId);
  }, [chats, chatId]);

  const { data: chatData, isLoading: chatLoading, error: chatError } = useQuery({
    queryKey: ['chat', chatId],
    queryFn: () => apiClient.getChat(chatId),
    enabled: !!chatId, // Only fetch if chatId exists
  });

  const { data: messagesData, isLoading: messagesLoading, error: messagesError, refetch } = useQuery({
    queryKey: ['messages', chatId],
    queryFn: () => apiClient.getMessages(chatId),
    enabled: !!chatId, // Only fetch if chatId exists
  });

  const translationViewMode = useTranslationStore((s) => s.viewModeByChatId[chatId] ?? 'original');
  const mergeTranslations = useTranslationStore((s) => s.mergeTranslations);
  const setTranslationViewMode = useTranslationStore((s) => s.setViewMode);
  const translations = useTranslationStore((s) => s.translations);

  const translationMap = useMemo(() => {
    const prefix = `${chatId}:`;
    const m: Record<number, string> = {};
    for (const [k, v] of Object.entries(translations)) {
      if (k.startsWith(prefix)) {
        m[Number(k.slice(prefix.length))] = v;
      }
    }
    return m;
  }, [translations, chatId]);

  const hasAnyTranslation = Object.keys(translationMap).length > 0;

  const rawMessages = messagesData?.data || messagesData || [];

  const handleLoadTranslations = async () => {
    if (translateReqRef.current || translateLoading) return;
    const list: Message[] = Array.isArray(rawMessages) ? rawMessages : [];
    const recent = list.slice(-TRANSLATE_MESSAGE_WINDOW);
    const store = useTranslationStore.getState();
    const idsNeeding: number[] = [];
    for (const m of recent) {
      const t = m.type || 'text';
      const body = m.body != null ? String(m.body).trim() : '';
      if (!body) continue;
      if (t !== 'text' && t !== 'payment_url') continue;
      if (store.getTranslation(chatId, m.id) === undefined) {
        idsNeeding.push(m.id);
      }
    }

    translateReqRef.current = true;
    setTranslateError(null);

    if (idsNeeding.length === 0) {
      setTranslationViewMode(chatId, 'uk');
      translateReqRef.current = false;
      return;
    }

    const requestChatId = chatId;
    setTranslateLoading(true);
    try {
      const res = await apiClient.translateChatMessages(requestChatId, idsNeeding);
      if (chatIdRef.current !== requestChatId) { translateReqRef.current = false; return; }
      if (res?.success && res.data?.translations) {
        const mapNum: Record<number, string> = {};
        for (const [id, text] of Object.entries(res.data.translations)) {
          mapNum[Number(id)] = String(text);
        }
        mergeTranslations(chatId, mapNum);
        setTranslationViewMode(chatId, 'uk');
      } else {
        setTranslateError(res?.error || 'Не вдалося отримати переклад');
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      const msg = err?.response?.data?.error || err?.message || 'Помилка перекладу';
      setTranslateError(typeof msg === 'string' ? msg : 'Помилка перекладу');
    } finally {
      setTranslateLoading(false);
      translateReqRef.current = false;
    }
  };

  useEffect(() => {
    chatIdRef.current = chatId;
    setTranslateError(null);
    setSendError(null);
    translateReqRef.current = false;
  }, [chatId]);

  const sendMessageMutation = useMutation({
    mutationFn: ({ body, file, metadata }: { body: string; file?: File; metadata?: any }) => {
      return apiClient.sendMessage(chatId, body, file, undefined, metadata);
    },
    onSuccess: (responseData, variables) => {
      
      const message = responseData.data;
      
      if (variables.metadata?.from_ai_suggestion && variables.metadata?.ai_run_id && message?.id) {
        apiClient.saveAiFeedback(chatId, {
          ai_run_id: variables.metadata.ai_run_id,
          selected_candidate_index: variables.metadata.ai_suggestion_index !== undefined 
            ? variables.metadata.ai_suggestion_index + 1  // Convert 0-based to 1-based
            : null,
          final_sent_content: variables.body,
          final_sent_message_id: message.id,
          was_edited: variables.metadata.was_edited || false,
        } as any).catch(() => {});
      }
      
      if (message && message.id) {
        queryClient.setQueryData(['messages', chatId], (oldData: any) => {
          // Handle both formats: { data: [...] } or just [...]
          const currentMessages = oldData?.data || oldData || [];
          
          if (Array.isArray(currentMessages) && currentMessages.some((m: any) => m.id === message.id)) return oldData;
          
          const newMessages = [...currentMessages, message];
          return oldData?.data ? { ...oldData, data: newMessages } : newMessages;
        });
      }
      
      setSendError(null);
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
    onError: (error: any, variables) => {
      const msg = error.response?.data?.message || error.message || 'Невідома помилка';
      setSendError({ message: msg, retryVars: error.response?.status !== 401 ? variables : null });
    },
  });

  const sendPaymentMutation = useMutation({
    mutationFn: (payload: { url: string; label?: string; caption?: string }) =>
      apiClient.sendPaymentLinkMessage(chatId, {
        paymentUrl: payload.url,
        caption: payload.caption,
        label: payload.label,
      }),
    onSuccess: (responseData) => {
      const message = responseData.data;
      if (message && message.id) {
        queryClient.setQueryData(['messages', chatId], (oldData: any) => {
          const currentMessages = oldData?.data || oldData || [];
          if (Array.isArray(currentMessages) && currentMessages.some((m: any) => m.id === message.id)) {
            return oldData;
          }
          const newMessages = [...currentMessages, message];
          if (oldData?.data) {
            return { ...oldData, data: newMessages };
          }
          return newMessages;
        });
      }
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
    onError: (error: any) => {
      setSendError({ message: error.response?.data?.message || error.message || 'Невідома помилка', retryVars: null });
    },
  });

  const handleSendMessage = (text: string, attachments: any[] = [], metadata?: any) => {
    console.log('📤 handleSendMessage called:', { text, attachments, textLength: text?.length || 0, metadata });
    
    if (!text?.trim() && attachments.length === 0) {
      console.warn('⚠️ Cannot send empty message');
      return;
    }

    // Get first file if any (API supports only one file per message)
    const file = attachments.length > 0 && attachments[0].file ? attachments[0].file : undefined;
    
    // API requires body field as string - use empty string if no text but file exists
    // Ensure body is always a string, not undefined or null
    const body = (text && text.trim()) ? text.trim() : '';
    
    if (!body && !file) {
      console.warn('⚠️ Cannot send message without text or file');
      return;
    }

    console.log('📤 Calling sendMessageMutation with:', { 
      body, 
      bodyType: typeof body,
      hasFile: !!file, 
      fileName: file?.name, 
      fileSize: file?.size,
      fileType: file?.type,
      metadata
    });
    sendMessageMutation.mutate({ body, file, metadata });
  };

  const handleSendPayment = (payload: { url: string; label?: string; caption?: string }) => {
    sendPaymentMutation.mutate(payload);
  };

  useEffect(() => {
    // Mark as read when chat is opened
    if (chatId) {
      // Mark chat as read and update store
      apiClient.markAsRead(chatId)
        .then(() => {
          // Update unread_count in store
          const { updateChat } = useChatStore.getState();
          updateChat(chatId, { unread_count: 0 });
          // Invalidate queries to refresh chat list
          queryClient.invalidateQueries({ queryKey: ['chats'] });
          queryClient.invalidateQueries({ queryKey: ['chat', chatId] });
        })
        .catch(() => {
          // Игнорируем ошибки
        });
      
      // Subscribe to this specific chat's WebSocket channel
      wsClient.subscribeToChat(chatId);
      
      // Unsubscribe when chat changes
      return () => {
        wsClient.unsubscribeFromChat(chatId);
      };
    }
  }, [chatId, queryClient]); // Оставляем только необходимые зависимости

  // Use chat from store if API data not loaded yet
  // Normalize assigned_manager field
  // Мемоизируем, чтобы избежать лишних ререндеров
  const displayChat = React.useMemo(() => {
    if (chatData) {
      return {
        ...chatData,
        assignedManager: chatData.assigned_manager || chatData.assignedManager,
      };
    }
    return chatFromStore;
  }, [chatData, chatFromStore]);
  
  if (chatLoading || messagesLoading) {
    return <div className="chat-window-loading">Завантаження...</div>;
  }

  if (chatError || messagesError) {
    console.error('❌ ChatWindow errors:', { chatError, messagesError });
    return (
      <div className="chat-window-loading" style={{ color: 'var(--error)' }}>
        Помилка завантаження. Перевірте консоль.
      </div>
    );
  }

  // Get client name from various possible fields
  // Check for client_nickname in metadata (renamed by manager)
  const client = displayChat?.clientUser;
  const clientNickname = displayChat?.metadata?.client_nickname;
  const clientName = clientNickname || client?.name || displayChat?.client_name || 'Unknown';
  const source = displayChat?.source || 'unknown';

  const handleBack = () => {
    setSelectedChat(null);
  };

  return (
    <div className="chat-window">
      <div className="chat-window-header">
        {isMobile() && (
          <button
            className="chat-back-btn"
            onClick={handleBack}
            aria-label="Назад до списку"
          >
            <IconArrowLeft size={24} />
          </button>
        )}
        <div className="chat-header-info">
          <h3>{clientName}</h3>
          <span className="chat-header-source">{source}</span>
        </div>
        <div className="chat-header-actions">
          <div className="chat-header-actions-group chat-header-actions-group--primary">
            <IconButton
              icon={<IconInfoCircle />}
              onClick={toggleClientCard}
              title="Інформація про клієнта"
              active={isClientCardOpen}
            />
            <IconButton
              icon={<IconUserPlus />}
              onClick={() => setShowAssignModal(true)}
              title="Призначити"
            />
            <IconButton
              icon={<IconCircleCheck />}
              onClick={() => setShowStatusModal(true)}
              title="Статус"
              active={displayChat?.status === 'in_progress'}
            />
          </div>
          <div className="chat-header-actions-group chat-header-actions-group--secondary">
            <IconButton
              icon={<IconTags />}
              onClick={() => setShowTagsModal(true)}
              title="Теги"
            />
            <IconButton
              icon={<IconNotes />}
              onClick={() => setShowNoteModal(true)}
              title="Нотатки та ім'я клієнта"
            />
            <IconButton
              icon={<IconShoppingCart />}
              onClick={() => setShowClientOrdersModal(true)}
              title="Замовлення клієнта"
            />
            <IconButton
              icon={<IconX />}
              onClick={async () => {
                if (!displayChat) return;
                try {
                  if (displayChat.metadata?.no_response_needed) {
                    await apiClient.unskipChat(chatId);
                  } else {
                    await apiClient.skipChat(chatId);
                  }
                  queryClient.invalidateQueries({ queryKey: ['chat', chatId] });
                  queryClient.invalidateQueries({ queryKey: ['chats'] });
                } catch (error) {
                  console.error('Failed to skip/unskip chat:', error);
                }
              }}
              title={displayChat?.metadata?.no_response_needed ? 'Повернути в список' : 'Скинути (не потребує відповіді)'}
              className={displayChat?.metadata?.no_response_needed ? 'skipped' : ''}
            />
            <IconButton
              icon={
                displayChat?.priority === 'urgent' ? <IconFlag3 /> :
                displayChat?.priority === 'high' ? <IconFlag2 /> :
                displayChat?.priority === 'low' ? <IconFlagOff /> :
                <IconFlag />
              }
              onClick={() => setShowPriorityModal(true)}
              title={`Пріоритет: ${displayChat?.priority || 'normal'}`}
              className={`priority-btn priority-${displayChat?.priority || 'normal'}`}
            />
          </div>
        </div>
      </div>

      <div className="chat-translate-bar" aria-label="Переклад діалогу">
        <button
          type="button"
          className="chat-translate-load-btn"
          onClick={handleLoadTranslations}
          disabled={translateLoading}
          title="Завантажити український переклад повідомлень (лише для цього чату)"
        >
          {translateLoading ? <span className="chat-translate-spinner" aria-hidden /> : <IconLanguage size={18} stroke={1.5} />}
          <span className="chat-translate-load-label">Переклад UA</span>
        </button>
        {hasAnyTranslation && (
          <div className="chat-translate-segmented" role="group" aria-label="Режим перегляду">
            <button
              type="button"
              className={`chat-translate-segment-btn${translationViewMode === 'original' ? ' is-active' : ''}`}
              aria-pressed={translationViewMode === 'original'}
              onClick={() => setTranslationViewMode(chatId, 'original')}
            >
              Оригінал
            </button>
            <button
              type="button"
              className={`chat-translate-segment-btn${translationViewMode === 'uk' ? ' is-active' : ''}`}
              aria-pressed={translationViewMode === 'uk'}
              onClick={() => setTranslationViewMode(chatId, 'uk')}
            >
              Переклад
            </button>
          </div>
        )}
        {translateError && (
          <span className="chat-translate-error" role="status">
            {translateError}
          </span>
        )}
      </div>

      {/* SLA Violation Warning */}
      {displayChat?.active_sla_violation && (
        <div className="sla-violation-banner">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M10 2L2 18H18L10 2Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <path
              d="M10 7V11M10 14H10.01"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <span>
            Нарушение SLA: {displayChat.active_sla_violation.sla_violation_type === 'response_time' 
              ? 'Превышено время ответа' 
              : 'Нарушение SLA'}
          </span>
          <button
            className="sla-ignore-btn"
            onClick={async () => {
              try {
                await apiClient.ignoreSlaViolation(chatId);
                queryClient.invalidateQueries({ queryKey: ['chat', chatId] });
                queryClient.invalidateQueries({ queryKey: ['chats'] });
              } catch (error) {
                console.error('Failed to ignore SLA violation:', error);
              }
            }}
            title="Игнорировать нарушение"
          >
            ×
          </button>
        </div>
      )}

      <div className="chat-message-list-host">
        <MessageList
          messages={messagesData?.data || messagesData || []}
          chatId={chatId}
          onUpdate={() => refetch()}
          searchQuery={searchQuery}
          translationViewMode={translationViewMode}
          translationMap={translationMap}
        />
      </div>

      {sendError && (
        <div className="send-error-bar">
          <span className="send-error-bar__text">Помилка: {sendError.message}</span>
          {sendError.retryVars && (
            <button
              className="send-error-bar__retry"
              onClick={() => { setSendError(null); sendMessageMutation.mutate(sendError.retryVars); }}
            >
              Повторити
            </button>
          )}
          <button className="send-error-bar__close" onClick={() => setSendError(null)}>✕</button>
        </div>
      )}
      <MessageInput
        onSend={handleSendMessage}
        onSendPayment={handleSendPayment}
        disabled={sendMessageMutation.isPending || sendPaymentMutation.isPending}
        chatId={chatId}
      />

      {showAssignModal && (
        <AssignModal
          chatId={chatId}
          currentManagerId={displayChat?.assigned_manager_id}
          onClose={() => setShowAssignModal(false)}
        />
      )}

      {showStatusModal && displayChat && (
        <StatusModal
          chatId={chatId}
          currentStatus={displayChat.status}
          onClose={() => setShowStatusModal(false)}
        />
      )}

      {showTagsModal && (
        <TagsModal
          chatId={chatId}
          currentTags={Array.isArray(displayChat?.metadata?.tags) ? displayChat.metadata.tags : []}
          onClose={() => setShowTagsModal(false)}
        />
      )}

      {showPriorityModal && displayChat && (
        <PriorityModal
          chatId={chatId}
          currentPriority={displayChat.priority || 'normal'}
          onClose={() => setShowPriorityModal(false)}
        />
      )}

      {showClientOrdersModal && (
        <ClientOrdersModal
          isOpen={showClientOrdersModal}
          onClose={() => setShowClientOrdersModal(false)}
          chatId={chatId}
        />
      )}

      {showNoteModal && (
        <NoteModal
          chatId={chatId}
          onClose={() => setShowNoteModal(false)}
        />
      )}
    </div>
  );
};

export default ChatWindow;

