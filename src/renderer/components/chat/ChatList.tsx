import React, { useEffect, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useChatStore } from '../../store/chatStore';
import { apiClient } from '../../api/client';
import ChatListItem from './ChatListItem';
import '../../styles/ChatList.css';

const ChatList: React.FC = () => {
  const { filters, chats, setChats, setSelectedChat } = useChatStore();
  const [tagSearch, setTagSearch] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['chats', filters],
    queryFn: () => apiClient.getChats(filters),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  useEffect(() => {
    if (data) {
      // Try different possible response structures
      let chatsArray = data.data || data.chats || data;
      
      // Ensure it's an array
      if (!Array.isArray(chatsArray)) {
        chatsArray = [];
      }
      
      setChats(chatsArray);
    } else if (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('ChatList error:', error);
      }
    }
  }, [data, error, setChats]);

  // Filter chats by tags
  const filteredChats = useMemo(() => {
    if (!tagSearch.trim()) {
      return chats;
    }

    const searchLower = tagSearch.toLowerCase().trim();
    return chats.filter((chat) => {
      if (!chat || !(chat.clientUser || chat.client_name)) {
        return false;
      }

      // Check if chat has tags in metadata
      if (chat.metadata && typeof chat.metadata === 'object' && chat.metadata.tags) {
        const tags = Array.isArray(chat.metadata.tags) ? chat.metadata.tags : [];
        // Check if any tag matches the search query
        return tags.some((tag: string) => 
          tag.toLowerCase().includes(searchLower)
        );
      }

      return false;
    });
  }, [chats, tagSearch]);

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

  return (
    <div className="chat-list">
      <div className="chat-list-header">
        <h3>Чаты</h3>
        <div className="chat-list-filters">
          <input
            type="text"
            placeholder="Поиск по тегам..."
            value={tagSearch}
            onChange={(e) => setTagSearch(e.target.value)}
            className="chat-list-tag-search"
          />
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
        {filteredChats.length === 0 ? (
          <div className="chat-list-empty">
            {tagSearch.trim() ? 'Чаты с такими тегами не найдены' : 'Нет чатов'}
          </div>
        ) : (
          filteredChats
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

