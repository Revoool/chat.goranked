import React from 'react';
import { OrderChatThread } from '../../types';
import { useChatStore } from '../../store/chatStore';
import { IconAlertCircle } from '../../icons';
import '../../styles/ChatListItem.css';

interface OrderChatListItemProps {
  thread: OrderChatThread;
  onClick: () => void;
}

const OrderChatListItem: React.FC<OrderChatListItemProps> = ({ thread, onClick }) => {
  const { selectedOrderChatId } = useChatStore();
  const isSelected = selectedOrderChatId === thread.id;

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

  // Для заказов маркетплейса (OrdersProducts)
  const productName = thread.product?.name || `Замовлення #${thread.id}`;
  const gameName = thread.game?.name || 'Unknown';
  const clientName = thread.user?.name || 'Unknown';
  const sellerName = thread.seller?.name || 'Unknown';

  return (
    <div
      className={`chat-list-item ${isSelected ? 'selected' : ''} ${thread.warning ? 'has-sla-violation' : ''}`}
      onClick={onClick}
    >
      <div className="chat-item-header">
        <div className="chat-item-client">
          <div className="chat-item-avatar" style={{ backgroundColor: 'var(--flame-orange)' }}>
            {gameName.charAt(0).toUpperCase()}
          </div>
          <div className="chat-item-info">
            <div className="chat-item-name-row">
              <div className="chat-item-name">{productName}</div>
              {thread.warning && (
                <div className="chat-item-sla-warning" title="Предупреждение">
                  <IconAlertCircle size={14} />
                </div>
              )}
            </div>
            <div className="chat-item-meta-row">
              <div className="chat-item-source">ID: {thread.id}</div>
              <div className="chat-item-manager">• {clientName}</div>
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
        <div className="chat-item-preview">
          {thread.last_message.author?.name && (
            <span className="chat-item-preview-sender">{thread.last_message.author.name}: </span>
          )}
          {(thread.last_message.body || '').substring(0, 60)}
          {(thread.last_message.body || '').length > 60 ? '...' : ''}
        </div>
      )}

      <div className="chat-item-footer">
        <div className="chat-item-footer-left">
          {gameName && (
            <div className="chat-item-status" style={{ backgroundColor: 'var(--flame-orange)' }}>
              {gameName}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderChatListItem;
