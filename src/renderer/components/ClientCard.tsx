import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useChatStore } from '../store/chatStore';
import '../styles/ClientCard.css';

interface ClientCardProps {
  chatId: number;
}

const ClientCard: React.FC<ClientCardProps> = ({ chatId }) => {
  const { setClientCardOpen } = useChatStore();
  const { data: chatData } = useQuery({
    queryKey: ['chat', chatId],
    queryFn: () => apiClient.getChat(chatId),
  });

  if (!chatData) {
    return (
      <div className="client-card">
        <div className="client-card-loading">Загрузка...</div>
      </div>
    );
  }

  const client = chatData.clientUser;
  const clientName = client?.name || chatData.client_name || 'Unknown';

  return (
    <div className="client-card">
      <div className="client-card-header">
        <h3>Карточка клиента</h3>
        <button 
          className="close-btn"
          onClick={() => setClientCardOpen(false)}
          title="Закрыть"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      <div className="client-card-content">
        <div className="client-avatar-large">
          {clientName.charAt(0).toUpperCase()}
        </div>

        <div className="client-info">
          <h4>{clientName}</h4>
          {chatData.client_username && <p>@{chatData.client_username}</p>}
          {chatData.client_phone && <p>📞 {chatData.client_phone}</p>}
          {client?.email && <p>✉️ {client.email}</p>}
          {chatData.source && <p>📱 {chatData.source}</p>}
        </div>

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

        <div className="client-notes">
          <h5>Заметки</h5>
          <textarea
            className="notes-textarea"
            placeholder="Внутренние заметки о клиенте..."
            rows={4}
          />
        </div>
      </div>
    </div>
  );
};

export default ClientCard;

