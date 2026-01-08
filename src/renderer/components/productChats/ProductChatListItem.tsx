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

  // Для ProductInquiry чатов
  const fullProductName = thread.name || (thread.product?.name || `Товар #${thread.product_id || thread.id}`);
  const productName = fullProductName.length > 40 ? fullProductName.substring(0, 40) + '...' : fullProductName;
  const gameName = thread.game?.name || 'Unknown';
  const buyerName = thread.buyer?.name || 'Unknown';
  const sellerName = thread.seller?.name || 'Unknown';

  return (
    <div
      className={`chat-list-item ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <div className="chat-item-header">
        <div className="chat-item-client">
          <div className="chat-item-avatar" style={{ backgroundColor: 'var(--flame-orange)' }}>
            {gameName.charAt(0).toUpperCase()}
          </div>
          <div className="chat-item-info">
            <div className="chat-item-name-row">
              <div 
                className="chat-item-name" 
                title={fullProductName !== productName ? fullProductName : undefined}
                style={{ 
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '100%'
                }}
              >
                {productName}
              </div>
            </div>
            <div className="chat-item-meta-row">
              <div className="chat-item-source">{buyerName}</div>
              {thread.buyer?.email && (
                <div className="chat-item-manager" title={thread.buyer.email}>• {thread.buyer.email}</div>
              )}
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

      {thread.last_message && (
        <div className="chat-item-footer">
          <div className="chat-item-last-message">
            {thread.last_message.body}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductChatListItem;
