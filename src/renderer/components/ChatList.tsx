import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useChatStore } from '../store/chatStore';
import { apiClient } from '../api/client';
import ChatListItem from './ChatListItem';
import '../styles/ChatList.css';

const ChatList: React.FC = () => {
  const { filters, chats, setChats, setSelectedChat } = useChatStore();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['chats', filters],
    queryFn: () => apiClient.getChats(filters),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  useEffect(() => {
    console.log('📋 ChatList useEffect triggered');
    console.log('📋 data:', data);
    console.log('📋 isLoading:', isLoading);
    console.log('📋 error:', error);
    console.log('📋 data?.data:', data?.data);
    
    if (data) {
      console.log('📋 Full data object:', JSON.stringify(data, null, 2));
      
      // Try different possible response structures
      let chatsArray = data.data || data.chats || data;
      
      // Ensure it's an array
      if (!Array.isArray(chatsArray)) {
        console.warn('⚠️ Chats data is not an array, converting:', typeof chatsArray);
        chatsArray = [];
      }
      
      console.log('📋 Extracted chats array:', chatsArray);
      console.log('📋 Chats array length:', chatsArray.length);
      
      if (chatsArray.length > 0) {
        console.log('✅ Setting chats:', chatsArray.length, 'chats');
        setChats(chatsArray);
      } else {
        console.warn('⚠️ No chats found in response');
        setChats([]);
      }
    } else if (error) {
      console.error('❌ Error in ChatList:', error);
    }
  }, [data, error, isLoading, setChats]);

  if (isLoading) {
    console.log('⏳ ChatList: Loading...');
    return (
      <div className="chat-list">
        <div className="chat-list-header">
          <h3>Чаты</h3>
        </div>
        <div className="chat-list-loading">Загрузка...</div>
      </div>
    );
  }

  if (error) {
    console.error('❌ ChatList: Error loading chats:', error);
    return (
      <div className="chat-list">
        <div className="chat-list-header">
          <h3>Чаты</h3>
        </div>
        <div className="chat-list-empty" style={{ color: 'var(--error)' }}>
          Ошибка загрузки чатов. Проверьте консоль.
        </div>
      </div>
    );
  }

  console.log('📋 ChatList render - chats:', chats);
  console.log('📋 ChatList render - chats length:', chats.length);

  return (
    <div className="chat-list">
      <div className="chat-list-header">
        <h3>Чаты</h3>
        <div className="chat-list-filters">
          <select
            value={filters.status || ''}
            onChange={(e) => {
              const status = e.target.value || undefined;
              useChatStore.getState().setFilters({ status: status as any });
            }}
          >
            <option value="">Все статусы</option>
            <option value="new">Новые</option>
            <option value="in_progress">В работе</option>
            <option value="snoozed">Отложенные</option>
            <option value="closed">Закрытые</option>
          </select>
        </div>
      </div>

      <div className="chat-list-items">
        {chats.length === 0 ? (
          <div className="chat-list-empty">Нет чатов</div>
        ) : (
          chats
            .filter((chat) => chat && (chat.clientUser || chat.client_name)) // Filter out invalid chats
            .map((chat) => (
              <ChatListItem
                key={chat.id}
                chat={chat}
                onClick={() => {
                  // Use chat.id (from manager_client_chats table)
                  console.log('📌 Selecting chat:', { id: chat.id });
                  setSelectedChat(chat.id);
                }}
              />
            ))
        )}
      </div>
    </div>
  );
};

export default ChatList;

