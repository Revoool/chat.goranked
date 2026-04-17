import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useChatStore } from '../../store/chatStore';
import { apiClient } from '../../api/client';
import ChatListItem from './ChatListItem';
import { List, RowComponentProps } from 'react-window';
import '../../styles/ChatList.css';

const ChatList: React.FC = () => {
  const { filters, chats, setChats, appendChats, setSelectedChat, setSearchQuery: setStoreSearchQuery } = useChatStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTagFilter, setShowTagFilter] = useState(false);
  const tagFilterRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [paginationMeta, setPaginationMeta] = useState<{
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  } | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(600); // Дефолтная высота

  // Вычисляем высоту списка для виртуализации
  useEffect(() => {
    const updateHeight = () => {
      if (listContainerRef.current) {
        const rect = listContainerRef.current.getBoundingClientRect();
        setListHeight(rect.height || 600);
      }
    };
    
    updateHeight();
    let resizeTimer: ReturnType<typeof setTimeout>;
    const debouncedUpdate = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(updateHeight, 100); };
    window.addEventListener('resize', debouncedUpdate);
    return () => { window.removeEventListener('resize', debouncedUpdate); clearTimeout(resizeTimer); };
  }, []);

  // Debounce поискового запроса (500ms задержка) - только для подсветки в сообщениях
  // НЕ обновляем filters, чтобы не вызывать перезагрузку списка чатов
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      // Сохраняем поисковый запрос в store для подсветки в сообщениях
      setStoreSearchQuery(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, setStoreSearchQuery]);

  // Загружаем чаты с пагинацией
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['chats', filters, currentPage],
    queryFn: () => apiClient.getChats({
      ...filters,
      page: currentPage,
      per_page: 20,
    }),
    refetchInterval: 60000, // Refetch every 60 seconds (reduced from 30s to save resources)
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

  // Обрабатываем загрузку данных с пагинацией
  useEffect(() => {
    if (data) {
      // Try different possible response structures
      let chatsArray = data.data || data.chats || data;
      
      // Ensure it's an array
      if (!Array.isArray(chatsArray)) {
        chatsArray = [];
      }
      
      // Сохраняем метаданные пагинации
      if (data.meta) {
        setPaginationMeta(data.meta);
      }
      
      // Если это первая страница - заменяем чаты, иначе добавляем
      if (currentPage === 1) {
      setChats(chatsArray);
      } else {
        appendChats(chatsArray);
        setIsLoadingMore(false);
      }
    } else if (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('ChatList error:', error);
      }
      setIsLoadingMore(false);
    }
  }, [data, error, setChats, appendChats, currentPage]);

  // Сбрасываем на первую страницу при изменении фильтров
  // НЕ очищаем чаты сразу - они будут заменены новыми данными из API
  useEffect(() => {
    setCurrentPage(1);
    setPaginationMeta(null);
    // Не очищаем чаты здесь - они будут заменены новыми данными из useQuery
  }, [filters.status, filters.source, filters.manager_id, filters.priority, filters.search]);

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

  // Фильтруем чаты по выбранным тегам и поисковому запросу (клиентская фильтрация)
  const filteredChats = useMemo(() => {
    let result = chats;

    // Клиентский поиск по имени и последнему сообщению (быстрый отклик)
    if (searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase().trim();
      result = result.filter((chat) => {
        if (!chat || !(chat.clientUser || chat.client_name)) {
          return false;
        }

        // Поиск по имени клиента
        const clientName = (chat.clientUser?.name || chat.client_name || '').toLowerCase();
        if (clientName.includes(searchLower)) {
          return true;
        }

        // Поиск по последнему сообщению
        if (chat.last_message?.body) {
          const lastMessage = chat.last_message.body.toLowerCase();
          if (lastMessage.includes(searchLower)) {
            return true;
          }
        }

        return false;
      });
    }

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
  }, [chats, selectedTags, searchQuery]);

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

      <div className="chat-list-items" ref={listContainerRef}>
        {filteredChats.length === 0 ? (
          <div className="chat-list-empty">
            {selectedTags.length > 0 || searchQuery.trim() 
              ? 'Чаты не найдены' 
              : 'Нет чатов'}
          </div>
        ) : (
          <>
            {/* Виртуализация для больших списков чатов - рендерим только видимые элементы */}
            {filteredChats.length > 50 ? (
              <List
                rowCount={filteredChats.filter((chat) => chat && (chat.clientUser || chat.client_name)).length}
                rowHeight={100} // Примерная высота одного элемента чата
                style={{ width: '100%', height: listHeight }}
                defaultHeight={listHeight} // Начальная высота для SSR
                overscanCount={5} // Рендерим 5 дополнительных элементов сверху и снизу для плавной прокрутки
                rowProps={{}} // Пустой объект, так как rowProps обязателен в react-window v2
                rowComponent={({ index, style }: RowComponentProps) => {
                  const validChats = filteredChats.filter((chat) => chat && (chat.clientUser || chat.client_name));
                  const chat = validChats[index];
                  if (!chat) {
                    // Возвращаем пустой div вместо null, так как rowComponent должен возвращать ReactElement
                    return <div style={style} />;
                  }
                  return (
                    <div style={style}>
                      <ChatListItem
                        chat={chat}
                        onClick={() => {
                          console.log('📌 Selecting chat:', { id: chat.id });
                          setSelectedChat(chat.id);
                        }}
                      />
                    </div>
                  );
                }}
              />
            ) : (
              // Для небольших списков используем обычный рендеринг
              <>
                {filteredChats
                  .filter((chat) => chat && (chat.clientUser || chat.client_name))
                  .map((chat) => (
                    <ChatListItem
                      key={chat.id}
                      chat={chat}
                      onClick={() => {
                        console.log('📌 Selecting chat:', { id: chat.id });
                        setSelectedChat(chat.id);
                      }}
                    />
                  ))}
              </>
            )}
            
            {/* Кнопка "Подгрузить еще" - показываем только если есть еще страницы и нет активных фильтров */}
            {paginationMeta && 
             paginationMeta.current_page < paginationMeta.last_page &&
             !searchQuery.trim() && 
             selectedTags.length === 0 && (
              <div className="chat-list-load-more">
                <button
                  className="chat-list-load-more-btn"
                  onClick={() => {
                    setIsLoadingMore(true);
                    setCurrentPage((prev) => prev + 1);
                  }}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore 
                    ? 'Загрузка...' 
                    : `Подгрузить еще (${Math.max(0, paginationMeta.total - (paginationMeta.current_page * paginationMeta.per_page))} осталось)`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ChatList;

