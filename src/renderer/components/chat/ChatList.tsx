import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useChatStore } from '../../store/chatStore';
import { apiClient } from '../../api/client';
import ChatListItem from './ChatListItem';
import '../../styles/ChatList.css';

const ChatList: React.FC = () => {
  const { filters, chats, setChats, setSelectedChat } = useChatStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTagFilter, setShowTagFilter] = useState(false);
  const tagFilterRef = useRef<HTMLDivElement>(null);

  // Обновляем фильтры при изменении поискового запроса
  useEffect(() => {
    if (searchQuery.trim()) {
      useChatStore.getState().setFilters({ search: searchQuery.trim() });
    } else {
      // Убираем поиск из фильтров, если поле пустое
      const currentFilters = useChatStore.getState().filters;
      const { search, ...restFilters } = currentFilters;
      useChatStore.getState().setFilters(restFilters);
    }
  }, [searchQuery]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['chats', filters],
    queryFn: () => apiClient.getChats(filters),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Закрываем dropdown при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tagFilterRef.current && !tagFilterRef.current.contains(event.target as Node)) {
        setShowTagFilter(false);
      }
    };

    if (showTagFilter) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTagFilter]);

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

  // Получаем все доступные теги из чатов
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    chats.forEach((chat) => {
      if (chat?.metadata?.tags && Array.isArray(chat.metadata.tags)) {
        chat.metadata.tags.forEach((tag: string) => {
          if (tag && typeof tag === 'string') {
            tagSet.add(tag);
          }
        });
      }
    });
    return Array.from(tagSet).sort();
  }, [chats]);

  // Фильтруем чаты по выбранным тегам (клиентская фильтрация)
  const filteredChats = useMemo(() => {
    let result = chats;

    // Фильтр по тегам
    if (selectedTags.length > 0) {
      result = result.filter((chat) => {
        if (!chat || !(chat.clientUser || chat.client_name)) {
          return false;
        }

        // Проверяем, есть ли у чата хотя бы один из выбранных тегов
        if (chat.metadata && typeof chat.metadata === 'object' && chat.metadata.tags) {
          const chatTags = Array.isArray(chat.metadata.tags) ? chat.metadata.tags : [];
          return selectedTags.some((selectedTag) => 
            chatTags.includes(selectedTag)
          );
        }

        return false;
      });
    }

    return result;
  }, [chats, selectedTags]);

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
            placeholder="Поиск по имени или сообщениям..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="chat-list-search"
          />
          <div className="chat-list-tag-filter-wrapper" ref={tagFilterRef}>
            <button
              type="button"
              className={`chat-list-tag-filter-btn ${selectedTags.length > 0 ? 'active' : ''}`}
              onClick={() => setShowTagFilter(!showTagFilter)}
              title={selectedTags.length > 0 ? `Выбрано тегов: ${selectedTags.length}` : 'Фильтр по тегам'}
            >
              <span>Теги {selectedTags.length > 0 && `(${selectedTags.length})`}</span>
            </button>
            {showTagFilter && (
              <div className="chat-list-tag-filter-dropdown">
                {availableTags.length === 0 ? (
                  <div className="chat-list-tag-filter-empty">Нет доступных тегов</div>
                ) : (
                  <>
                    <div className="chat-list-tag-filter-header">
                      <span>Выберите теги:</span>
                      {selectedTags.length > 0 && (
                        <button
                          type="button"
                          className="chat-list-tag-filter-clear"
                          onClick={() => setSelectedTags([])}
                        >
                          Очистить
                        </button>
                      )}
                    </div>
                    <div className="chat-list-tag-filter-list">
                      {availableTags.map((tag) => (
                        <label key={tag} className="chat-list-tag-filter-item">
                          <input
                            type="checkbox"
                            checked={selectedTags.includes(tag)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedTags([...selectedTags, tag]);
                              } else {
                                setSelectedTags(selectedTags.filter((t) => t !== tag));
                              }
                            }}
                          />
                          <span>{tag}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
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
            {selectedTags.length > 0 || searchQuery.trim() 
              ? 'Чаты не найдены' 
              : 'Нет чатов'}
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

