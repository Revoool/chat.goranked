import React, { useEffect, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useChatStore } from '../../store/chatStore';
import { apiClient } from '../../api/client';
import OrderChatListItem from './OrderChatListItem';
import '../../styles/ChatList.css';

const OrderChatList: React.FC = () => {
  const { setSelectedOrderChat } = useChatStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [paginationMeta, setPaginationMeta] = useState<{
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  } | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [threads, setThreads] = useState<any[]>([]);

  const { activeMenu } = useChatStore();

  // Загружаем чаты заказов маркетплейса с пагинацией
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['order-chats', searchQuery, currentPage],
    queryFn: () => apiClient.getProductChatThreads({
      q: searchQuery || undefined,
      sort_by: 'updated_at', // Сортировка по последнему сообщению
      sort_dir: 'desc',
      page: currentPage,
      per_page: 20,
    }),
    enabled: activeMenu === 'order-chats', // Загружаем только когда активна вкладка
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Принудительно обновляем данные при переключении на вкладку
  useEffect(() => {
    if (activeMenu === 'order-chats') {
      refetch();
    }
  }, [activeMenu, refetch]);

  // Обрабатываем загрузку данных с пагинацией
  useEffect(() => {
    if (data) {
      let threadsArray = data.data || [];
      
      if (!Array.isArray(threadsArray)) {
        threadsArray = [];
      }
      
      // Сохраняем метаданные пагинации
      if (data.meta) {
        setPaginationMeta(data.meta);
      }
      
      // Если это первая страница - заменяем, иначе добавляем
      if (currentPage === 1) {
        setThreads(threadsArray);
      } else {
        setThreads((prev) => {
          const existingIds = new Set(prev.map((t) => t.id));
          const uniqueNew = threadsArray.filter((t: any) => !existingIds.has(t.id));
          return [...prev, ...uniqueNew];
        });
        setIsLoadingMore(false);
      }
    } else if (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('OrderChatList error:', error);
      }
      setIsLoadingMore(false);
    }
  }, [data, error, currentPage]);

  // Сбрасываем на первую страницу при изменении поиска
  useEffect(() => {
    setCurrentPage(1);
    setThreads([]);
    setPaginationMeta(null);
  }, [searchQuery]);

  // Фильтруем по поисковому запросу (клиентская фильтрация)
  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) {
      return threads;
    }
    
    const searchLower = searchQuery.toLowerCase().trim();
    return threads.filter((thread) => {
      const productName = (thread.product?.name || '').toLowerCase();
      const gameName = (thread.game?.name || '').toLowerCase();
      const clientName = (thread.user?.name || '').toLowerCase();
      const sellerName = (thread.seller?.name || '').toLowerCase();
      const orderId = String(thread.id || '');
      
      return (
        productName.includes(searchLower) ||
        gameName.includes(searchLower) ||
        clientName.includes(searchLower) ||
        sellerName.includes(searchLower) ||
        orderId.includes(searchLower) ||
        (thread.last_message?.body || '').toLowerCase().includes(searchLower)
      );
    });
  }, [threads, searchQuery]);

  if (isLoading && threads.length === 0) {
    return (
      <div className="chat-list">
        <div className="chat-list-header">
          <h3>Чати замовлень</h3>
        </div>
        <div className="chat-list-loading">Загрузка...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="chat-list">
        <div className="chat-list-header">
          <h3>Чати замовлень</h3>
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
        <h3>Чати замовлень</h3>
        <div className="chat-list-filters">
          <input
            type="text"
            placeholder="Поиск по товару, игрі, продавцю..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="chat-list-search"
          />
        </div>
      </div>

      <div className="chat-list-items">
        {filteredThreads.length === 0 ? (
          <div className="chat-list-empty">
            {searchQuery.trim() ? 'Чаты не найдены' : 'Нет чатов'}
          </div>
        ) : (
          <>
            {filteredThreads.map((thread) => (
              <OrderChatListItem
                key={thread.id}
                thread={thread}
                onClick={() => {
                  console.log('📌 Selecting order chat:', { id: thread.id });
                  setSelectedOrderChat(thread.id);
                }}
              />
            ))}
            
            {/* Кнопка "Подгрузить еще" */}
            {paginationMeta && 
             paginationMeta.current_page < paginationMeta.last_page &&
             !searchQuery.trim() && (
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

export default OrderChatList;
