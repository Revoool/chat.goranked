import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { useChatStore } from '../../store/chatStore';
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
  IconNotes
} from '../../icons';
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

const ChatWindow: React.FC<ChatWindowProps> = ({ chatId }) => {
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showTagsModal, setShowTagsModal] = useState(false);
  const [showPriorityModal, setShowPriorityModal] = useState(false);
  const [showClientOrdersModal, setShowClientOrdersModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const { updateChat, chats, toggleClientCard, isClientCardOpen, searchQuery } = useChatStore();
  const queryClient = useQueryClient();

  console.log('💬 ChatWindow rendered for chatId:', chatId);
  
  // Try to get chat from store first
  const chatFromStore = chats.find(c => c.id === chatId);
  console.log('💬 Chat from store:', chatFromStore);

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

  console.log('💬 ChatWindow state:', {
    chatId,
    chatData,
    chatLoading,
    chatError,
    messagesData,
    messagesLoading,
    messagesError,
  });

  const sendMessageMutation = useMutation({
    mutationFn: ({ body, file, metadata }: { body: string; file?: File; metadata?: any }) => {
      console.log('📤 Sending message:', { chatId, body, hasFile: !!file, metadata });
      return apiClient.sendMessage(chatId, body, file, undefined, metadata);
    },
    onSuccess: (responseData, variables) => {
      console.log('✅ Message sent successfully, full response:', responseData);
      
      // API returns { data: { message object }, chat: {...} }
      // According to API_QUESTIONS.md, response format is:
      // { data: { id, chat_id, from_manager, user_id, body, type, ... }, chat: {...} }
      const message = responseData.data;
      
      console.log('📝 Extracted message from response:', message);
      
      // Если сообщение было отправлено с AI suggestion - сохраняем feedback
      if (variables.metadata?.from_ai_suggestion && variables.metadata?.ai_run_id && message?.id) {
        apiClient.saveAiFeedback(chatId, {
          ai_run_id: variables.metadata.ai_run_id,
          selected_candidate_index: variables.metadata.ai_suggestion_index !== undefined 
            ? variables.metadata.ai_suggestion_index + 1  // Convert 0-based to 1-based
            : null,
          final_sent_content: variables.body,
          final_sent_message_id: message.id,
          was_edited: variables.metadata.was_edited || false, // Используем was_edited из метаданных
        } as any).catch(() => {
          // Игнорируем ошибки сохранения feedback
        });
      }
      
      // Optimistically add message to the list immediately
      if (message && message.id) {
        console.log('📝 Adding message to cache optimistically:', message);
        queryClient.setQueryData(['messages', chatId], (oldData: any) => {
          // Handle both formats: { data: [...] } or just [...]
          const currentMessages = oldData?.data || oldData || [];
          
          // Check if message already exists (avoid duplicates)
          if (Array.isArray(currentMessages) && currentMessages.some((m: any) => m.id === message.id)) {
            console.log('⚠️ Message already in cache, skipping');
            return oldData;
          }
          
          // Add new message to the end
          const newMessages = [...currentMessages, message];
          console.log('📝 Updated messages count:', newMessages.length);
          
          // Return in the same format as received
          if (oldData?.data) {
            return { ...oldData, data: newMessages };
          }
          return newMessages;
        });
      } else {
        console.warn('⚠️ No message data in response, will refetch');
      }
      
      // Refetch to ensure consistency (in case WebSocket doesn't fire immediately)
      setTimeout(() => {
        refetch();
        queryClient.invalidateQueries({ queryKey: ['chats'] });
        queryClient.invalidateQueries({ queryKey: ['chat', chatId] });
      }, 500);
    },
    onError: (error: any) => {
      console.error('❌ Error sending message:', error);
      console.error('❌ Error response:', error.response);
      console.error('❌ Error status:', error.response?.status);
      console.error('❌ Error data:', error.response?.data);
      alert(`Помилка відправки повідомлення: ${error.response?.data?.message || error.message || 'Невідома помилка'}`);
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
  const displayChat = useMemo(() => {
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

  return (
    <div className="chat-window">
      <div className="chat-window-header">
        <div className="chat-header-info">
          <h3>{clientName}</h3>
          <span className="chat-header-source">{source}</span>
        </div>
        <div className="chat-header-actions">
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

      <MessageList 
        messages={messagesData?.data || messagesData || []} 
        chatId={chatId}
        onUpdate={() => refetch()}
        searchQuery={searchQuery}
      />

      <MessageInput
        onSend={handleSendMessage}
        disabled={sendMessageMutation.isPending}
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

