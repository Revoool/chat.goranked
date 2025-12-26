import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useChatStore } from '../store/chatStore';
import { IconPhone, IconMail, IconDeviceMobile } from '../icons';
import '../styles/ClientCard.css';

interface ClientCardProps {
  chatId: number;
}

const ClientCard: React.FC<ClientCardProps> = ({ chatId }) => {
  const { setClientCardOpen } = useChatStore();
  const [clientInfo, setClientInfo] = useState<any>(null);
  
  const { data: chatData } = useQuery({
    queryKey: ['chat', chatId],
    queryFn: () => apiClient.getChat(chatId),
  });

  // Загружаем дополнительную информацию о клиенте
  useEffect(() => {
    const loadClientInfo = async () => {
      try {
        const info = await apiClient.getClientInfo(chatId);
        setClientInfo(info);
      } catch (error) {
        console.warn('Failed to load client info:', error);
        // Не критично, продолжаем без этой информации
      }
    };

    if (chatId) {
      loadClientInfo();
      // Обновляем информацию каждые 15 секунд
      const interval = setInterval(loadClientInfo, 15000);
      return () => clearInterval(interval);
    }
  }, [chatId]);

  if (!chatData) {
    return (
      <div className="client-card">
        <div className="client-card-loading">Завантаження...</div>
      </div>
    );
  }

  const client = chatData.clientUser;
  const clientName = client?.name || chatData.client_name || 'Unknown';
  const clientAvatar = chatData.client_avatar || client?.avatar;

  return (
    <div className="client-card">
      <div className="client-card-header">
        <h3>Картка клієнта</h3>
        <button 
          className="close-btn"
          onClick={() => setClientCardOpen(false)}
          title="Закрити"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      <div className="client-card-content">
        <div className="client-avatar-large">
          {clientAvatar ? (
            <img 
              src={clientAvatar} 
              alt={clientName}
              onError={(e) => {
                // Fallback на инициал, если изображение не загрузилось
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  parent.textContent = clientName.charAt(0).toUpperCase();
                }
              }}
            />
          ) : (
            clientName.charAt(0).toUpperCase()
          )}
        </div>

        <div className="client-info">
          <h4>{clientName}</h4>
          {chatData.client_username && <p>@{chatData.client_username}</p>}
          {chatData.client_phone && (
            <p>
              <IconPhone size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
              {chatData.client_phone}
            </p>
          )}
          {client?.email && (
            <p>
              <IconMail size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
              {client.email}
            </p>
          )}
          {chatData.source && (
            <p>
              <IconDeviceMobile size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
              {chatData.source}
            </p>
          )}
        </div>

        {/* Додаткова інформація про клієнта */}
        {clientInfo && (
          <div className="client-additional-info">
            <h5>Додаткова інформація</h5>
            <div className="info-grid">
              {clientInfo.country_name && (
                <div className="info-item">
                  <span className="info-label">Країна:</span>
                  <span className="info-value">
                    {clientInfo.country_name} {clientInfo.country && `(${clientInfo.country})`}
                  </span>
                </div>
              )}
              {clientInfo.city && (
                <div className="info-item">
                  <span className="info-label">Місто:</span>
                  <span className="info-value">{clientInfo.city}</span>
                </div>
              )}
              {clientInfo.ip && (
                <div className="info-item">
                  <span className="info-label">IP:</span>
                  <span className="info-value">{clientInfo.ip}</span>
                </div>
              )}
              {clientInfo.current_page && (
                <div className="info-item">
                  <span className="info-label">Поточна сторінка:</span>
                  <span className="info-value">{clientInfo.current_page}</span>
                </div>
              )}
              {clientInfo.time_on_site && (
                <div className="info-item">
                  <span className="info-label">Час на сайті:</span>
                  <span className="info-value">{clientInfo.time_on_site}</span>
                </div>
              )}
              {clientInfo.total_visits !== undefined && (
                <div className="info-item">
                  <span className="info-label">Відвідувань:</span>
                  <span className="info-value">{clientInfo.total_visits}</span>
                </div>
              )}
            </div>

            {/* Історія відвідувань */}
            {clientInfo.page_visits && clientInfo.page_visits.length > 0 && (
              <div className="page-visits">
                <h6>Відвідані сторінки:</h6>
                <div className="visits-list">
                  {clientInfo.page_visits.slice(0, 5).map((visit: any, index: number) => (
                    <div key={index} className="visit-item">
                      <span className="visit-url">{visit.url}</span>
                      {visit.last_active && (
                        <span className="visit-time">{new Date(visit.last_active).toLocaleString('ru-RU')}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {chatData.metadata && typeof chatData.metadata === 'object' && chatData.metadata.tags && Array.isArray(chatData.metadata.tags) && chatData.metadata.tags.length > 0 && (
          <div className="client-tags">
            <h5>Теги</h5>
            <div className="tags-list">
              {chatData.metadata.tags.map((tag: string) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {chatData.metadata?.note && (
          <div className="client-notes">
            <h5>Нотатки</h5>
            <div className="notes-content">
              {chatData.metadata.note}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientCard;

