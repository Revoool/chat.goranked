import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useChatStore } from '../store/chatStore';
import { wsClient } from '../api/websocket';
import { useAuthStore } from '../store/authStore';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import AssignModal from './AssignModal';
import StatusModal from './StatusModal';
import TagsModal from './TagsModal';
import '../styles/ChatWindow.css';

interface ChatWindowProps {
  chatId: number;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ chatId }) => {
  const [isTyping, setIsTyping] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showTagsModal, setShowTagsModal] = useState(false);
  const { updateChat, chats, toggleClientCard, isClientCardOpen } = useChatStore();
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
    mutationFn: ({ body, file }: { body: string; file?: File }) => {
      console.log('📤 Sending message:', { chatId, body, hasFile: !!file });
      return apiClient.sendMessage(chatId, body, file);
    },
    onSuccess: (responseData) => {
      console.log('✅ Message sent successfully, full response:', responseData);
      
      // API returns { data: { message object }, chat: {...} }
      // According to API_QUESTIONS.md, response format is:
      // { data: { id, chat_id, from_manager, user_id, body, type, ... }, chat: {...} }
      const message = responseData.data;
      
      console.log('📝 Extracted message from response:', message);
      
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
      alert(`Ошибка отправки сообщения: ${error.response?.data?.message || error.message || 'Неизвестная ошибка'}`);
    },
  });

  const handleSendMessage = (text: string, attachments: any[] = []) => {
    console.log('📤 handleSendMessage called:', { text, attachments, textLength: text?.length || 0 });
    
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
      fileType: file?.type 
    });
    sendMessageMutation.mutate({ body, file });
  };

  useEffect(() => {
    // Mark as read when chat is opened
    if (chatId) {
      // Mark chat as read and update store
      apiClient.markAsRead(chatId)
        .then(() => {
          console.log('✅ Chat marked as read:', chatId);
          // Update unread_count in store
          updateChat(chatId, { unread_count: 0 });
          // Invalidate queries to refresh chat list
          queryClient.invalidateQueries({ queryKey: ['chats'] });
          queryClient.invalidateQueries({ queryKey: ['chat', chatId] });
        })
        .catch((error) => {
          console.error('❌ Failed to mark chat as read:', error);
        });
      
      // Subscribe to this specific chat's WebSocket channel
      wsClient.subscribeToChat(chatId);
      console.log('📡 Subscribed to chat channel:', chatId);
      
      // Unsubscribe when chat changes
      return () => {
        wsClient.unsubscribeFromChat(chatId);
        console.log('📡 Unsubscribed from chat channel:', chatId);
      };
    }
  }, [chatId, updateChat, queryClient]);

  // Use chat from store if API data not loaded yet
  const displayChat = chatData || chatFromStore;
  
  if (chatLoading || messagesLoading) {
    return <div className="chat-window-loading">Загрузка...</div>;
  }

  if (chatError || messagesError) {
    console.error('❌ ChatWindow errors:', { chatError, messagesError });
    return (
      <div className="chat-window-loading" style={{ color: 'var(--error)' }}>
        Ошибка загрузки. Проверьте консоль.
      </div>
    );
  }

  // Get client name from various possible fields
  const client = displayChat?.clientUser;
  const clientName = client?.name || displayChat?.client_name || 'Unknown';
  const source = displayChat?.source || 'unknown';

  return (
    <div className="chat-window">
      <div className="chat-window-header">
        <div className="chat-header-info">
          <h3>{clientName}</h3>
          <span className="chat-header-source">{source}</span>
        </div>
        <div className="chat-header-actions">
          <button 
            className={`info-btn ${isClientCardOpen ? 'active' : ''}`}
            onClick={toggleClientCard}
            title="Информация о клиенте"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              <path d="M10 7V10M10 13H10.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          <button 
            className="chat-action-btn"
            onClick={() => setShowAssignModal(true)}
          >
            Назначить
          </button>
          <button 
            className={`chat-action-btn ${displayChat?.status === 'in_progress' ? 'active' : ''}`}
            onClick={() => setShowStatusModal(true)}
          >
            Статус
          </button>
          <button 
            className="chat-action-btn"
            onClick={() => setShowTagsModal(true)}
          >
            Теги
          </button>
        </div>
      </div>

      <MessageList messages={messagesData?.data || messagesData || []} />

      <MessageInput
        onSend={handleSendMessage}
        disabled={sendMessageMutation.isPending}
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
          currentTags={displayChat?.metadata?.tags || []}
          onClose={() => setShowTagsModal(false)}
        />
      )}
    </div>
  );
};

export default ChatWindow;

