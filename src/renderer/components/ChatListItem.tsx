import React from 'react';
import { Chat } from '../types';
import { useChatStore } from '../store/chatStore';
import '../styles/ChatListItem.css';

interface ChatListItemProps {
  chat: Chat;
  onClick: () => void;
}

const ChatListItem: React.FC<ChatListItemProps> = ({ chat, onClick }) => {
  const { selectedChatId } = useChatStore();
  const isSelected = selectedChatId === chat.id;

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'только что';
    if (minutes < 60) return `${minutes}м`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}ч`;
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_progress': return 'var(--flame-orange)';
      case 'closed': return 'var(--text-muted)';
      case 'snoozed': return 'var(--champion-gold)';
      case 'new': return 'var(--success)';
      default: return 'var(--text-muted)';
    }
  };

  // Safety checks
  if (!chat) {
    return null;
  }

  // Use clientUser relation or fallback to client_name
  const client = chat.clientUser;
  const clientName = client?.name || chat.client_name || 'Unknown';
  const clientAvatar = chat.client_avatar || client?.avatar;
  const source = chat.source || 'unknown';

  return (
    <div
      className={`chat-list-item ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <div className="chat-item-header">
        <div className="chat-item-client">
          <div className="chat-item-avatar">
            {clientAvatar ? (
              <img 
                src={clientAvatar} 
                alt={clientName}
                onError={(e) => {
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
          <div className="chat-item-info">
            <div className="chat-item-name">{clientName}</div>
            <div className="chat-item-source">{source}</div>
          </div>
        </div>
        <div className="chat-item-meta">
          {(chat.unread_count || 0) > 0 && (
            <span className="chat-item-unread">{chat.unread_count}</span>
          )}
          {chat.last_message_at && (
            <span className="chat-item-time">
              {formatTime(chat.last_message_at)}
            </span>
          )}
        </div>
      </div>

      {chat.last_message && (
        <div className="chat-item-preview">
          {(chat.last_message.body || '').substring(0, 60)}
          {(chat.last_message.body || '').length > 60 ? '...' : ''}
        </div>
      )}

      <div className="chat-item-footer">
        {chat.status && (
          <div
            className="chat-item-status"
            style={{ backgroundColor: getStatusColor(chat.status) }}
          >
            {chat.status}
          </div>
        )}
        {chat.metadata && typeof chat.metadata === 'object' && chat.metadata.tags && Array.isArray(chat.metadata.tags) && chat.metadata.tags.length > 0 && (
          <div className="chat-item-tags">
            {chat.metadata.tags.slice(0, 2).map((tag: string) => (
              <span key={tag} className="chat-item-tag">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatListItem;

