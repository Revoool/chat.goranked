import React from 'react';
import { ProductChatThread } from '../../types';
import { useChatStore } from '../../store/chatStore';
import '../../styles/ChatListItem.css';

interface ProductChatListItemProps {
  thread: ProductChatThread;
  onClick: () => void;
}

const ProductChatListItem: React.FC<ProductChatListItemProps> = ({ thread, onClick }) => {
  const { selectedProductChatId } = useChatStore();
  const isSelected = selectedProductChatId === thread.id;

  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'только что';
    if (minutes < 60) return `${minutes}м`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}ч`;
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  const productName = thread.name || 'Unknown';
  const gameName = thread.game?.name || 'Unknown';
  const sellerName = thread.seller?.name || 'Unknown';
  const buyerName = thread.buyer?.name || 'Unknown';

  return (
    <div
      className={`chat-list-item ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <div className="chat-item-header">
        <div className="chat-item-client">
          <div className="chat-item-avatar" style={{ backgroundColor: 'var(--flame-orange)' }}>
            {thread.game?.icon ? (
              <img 
                src={`${process.env.API_BASE_URL || ''}/storage/${thread.game.icon}`} 
                alt={gameName}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              gameName.charAt(0).toUpperCase()
            )}
          </div>
          <div className="chat-item-info">
            <div className="chat-item-name-row">
              <div className="chat-item-name">{productName}</div>
            </div>
            <div className="chat-item-meta-row">
              <div className="chat-item-source">{buyerName}</div>
              <div className="chat-item-manager">• {gameName}</div>
            </div>
          </div>
        </div>
        <div className="chat-item-meta">
          {(thread.unread_count || 0) > 0 && (
            <span className="chat-item-unread">{thread.unread_count}</span>
          )}
          {thread.updated_at && (
            <span className="chat-item-time">
              {formatTime(thread.updated_at)}
            </span>
          )}
        </div>
      </div>

      <div className="chat-item-footer">
        <div className="chat-item-footer-left">
          <div className="chat-item-status" style={{ backgroundColor: 'var(--graphite-light)' }}>
            Продавець: {sellerName}
          </div>
          {thread.inquiry_messages_count > 0 && (
            <div className="chat-item-status" style={{ backgroundColor: 'var(--graphite-light)', marginLeft: '8px' }}>
              {thread.inquiry_messages_count} повідомлень
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductChatListItem;
