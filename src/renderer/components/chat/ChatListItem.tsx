import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Chat } from '../../types';
import { useChatStore } from '../../store/chatStore';
import { apiClient } from '../../api/client';
import { useQueryClient } from '@tanstack/react-query';
import { IconCircleDot, IconAlertCircle, IconFlag, IconFlag2, IconFlag3, IconFlagOff } from '../../icons';
import '../../styles/ChatListItem.css';

interface ChatListItemProps {
  chat: Chat;
  onClick: () => void;
}

const ChatListItem: React.FC<ChatListItemProps> = ({ chat, onClick }) => {
  const { selectedChatId, updateChat } = useChatStore();
  const queryClient = useQueryClient();
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [isMarkingUnread, setIsMarkingUnread] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const itemRef = useRef<HTMLDivElement>(null);
  const isSelected = selectedChatId === chat.id;

  // Мемоизируем formatTime чтобы избежать пересоздания функции
  const formatTime = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'только что';
    if (minutes < 60) return `${minutes}м`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}ч`;
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_progress': return 'var(--flame-orange)';
      case 'closed': return 'var(--text-muted)';
      case 'snoozed': return 'var(--champion-gold)';
      case 'new': return 'var(--success)';
      default: return 'var(--text-muted)';
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'urgent': return '#f44336';
      case 'high': return '#ff9800';
      case 'normal': return '#2196f3';
      case 'low': return '#4caf50';
      default: return 'transparent';
    }
  };

  const getPriorityIcon = (priority?: string) => {
    switch (priority) {
      case 'urgent': return <IconFlag3 size={14} />;
      case 'high': return <IconFlag2 size={14} />;
      case 'normal': return <IconFlag size={14} />;
      case 'low': return <IconFlagOff size={14} />;
      default: return null;
    }
  };

  const getPriorityLabel = (priority?: string) => {
    switch (priority) {
      case 'urgent': return 'Терміново';
      case 'high': return 'Високий';
      case 'normal': return 'Нормальний';
      case 'low': return 'Низький';
      default: return '';
    }
  };

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(event.target as Node) &&
        itemRef.current &&
        !itemRef.current.contains(event.target as Node)
      ) {
        setShowContextMenu(false);
        setContextMenuPosition(null);
      }
    };

    if (showContextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showContextMenu]);

  const handleMarkAsUnread = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isMarkingUnread) return;
    setIsMarkingUnread(true);
    try {
      // Mark last message as unread to make chat appear unread
      if (chat.last_message) {
        await apiClient.markMessageAsUnread(chat.id, chat.last_message.id);
      } else {
        // If no last message, we can't mark as unread via API
        // But we can update local state to show unread badge
        updateChat(chat.id, { unread_count: 1 });
      }
      setShowContextMenu(false);
      setContextMenuPosition(null);
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      queryClient.invalidateQueries({ queryKey: ['chat', chat.id] });
    } catch (error) {
      console.error('Error marking chat as unread:', error);
    } finally {
      setIsMarkingUnread(false);
    }
  };

  // Safety checks
  if (!chat) {
    return null;
  }

  // Мемоизируем вычисляемые значения
  const { clientName, clientAvatar, source, hasSlaViolation } = useMemo(() => {
    const client = chat.clientUser;
    const clientNickname = chat.metadata?.client_nickname;
    return {
      clientName: clientNickname || client?.name || chat.client_name || 'Unknown',
      clientAvatar: chat.client_avatar || client?.avatar,
      source: chat.source || 'unknown',
      hasSlaViolation: chat.active_sla_violation || chat.sla_attention,
    };
  }, [chat.clientUser, chat.metadata?.client_nickname, chat.client_name, chat.client_avatar, chat.source, chat.active_sla_violation, chat.sla_attention]);

  // Calculate context menu position
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = itemRef.current?.getBoundingClientRect();
    if (rect) {
      setContextMenuPosition({
        top: rect.bottom + 4,
        left: rect.left + rect.width / 2,
      });
      setShowContextMenu(true);
    }
  };

  return (
    <div
      ref={itemRef}
      className={`chat-list-item ${isSelected ? 'selected' : ''} ${hasSlaViolation ? 'has-sla-violation' : ''}`}
      onClick={onClick}
      onContextMenu={handleContextMenu}
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
            <div className="chat-item-name-row">
              <div className="chat-item-name">{clientName}</div>
              {chat.priority && (
                <div 
                  className="chat-item-priority"
                  style={{ color: getPriorityColor(chat.priority) }}
                  title={getPriorityLabel(chat.priority)}
                >
                  {getPriorityIcon(chat.priority)}
                </div>
              )}
              {hasSlaViolation && (
                <div className="chat-item-sla-warning" title="Нарушение SLA">
                  <IconAlertCircle size={14} />
                </div>
              )}
            </div>
            <div className="chat-item-meta-row">
              <div className="chat-item-source">{source}</div>
              {chat.assigned_manager && (
                <div className="chat-item-manager">
                  • {chat.assigned_manager.name}
                </div>
              )}
            </div>
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
          {chat.last_message.from_manager && (
            <span className="chat-item-preview-sender">Ви: </span>
          )}
          {(chat.last_message.body || '').substring(0, 60)}
          {(chat.last_message.body || '').length > 60 ? '...' : ''}
        </div>
      )}

      <div className="chat-item-footer">
        <div className="chat-item-footer-left">
          {chat.status && (
            <div
              className="chat-item-status"
              style={{ backgroundColor: getStatusColor(chat.status) }}
            >
              {chat.status === 'new' ? 'Новий' : 
               chat.status === 'in_progress' ? 'В роботі' :
               chat.status === 'snoozed' ? 'Відкладено' :
               chat.status === 'closed' ? 'Закрито' : chat.status}
            </div>
          )}
          {chat.priority && (
            <div
              className="chat-item-priority-badge"
              style={{ 
                backgroundColor: getPriorityColor(chat.priority),
                color: 'white'
              }}
            >
              {getPriorityLabel(chat.priority)}
            </div>
          )}
        </div>
        {chat.metadata && typeof chat.metadata === 'object' && chat.metadata.tags && Array.isArray(chat.metadata.tags) && chat.metadata.tags.length > 0 && (
          <div className="chat-item-tags">
            {chat.metadata.tags.slice(0, 2).map((tag: string) => (
              <span key={tag} className="chat-item-tag">
                {tag}
              </span>
            ))}
            {chat.metadata.tags.length > 2 && (
              <span className="chat-item-tag-more">+{chat.metadata.tags.length - 2}</span>
            )}
          </div>
        )}
      </div>

      {showContextMenu && contextMenuPosition && (
        <div 
          ref={contextMenuRef} 
          className="chat-item-context-menu"
          style={{
            position: 'fixed',
            top: `${contextMenuPosition.top}px`,
            left: `${contextMenuPosition.left}px`,
            transform: 'translateX(-50%)',
          }}
        >
          <button
            className="context-menu-item"
            onClick={handleMarkAsUnread}
            disabled={isMarkingUnread}
          >
            <IconCircleDot size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} />
            {isMarkingUnread ? 'Позначається...' : 'Позначити як непрочитане'}
          </button>
        </div>
      )}
    </div>
  );
};

// Мемоизируем компонент для предотвращения лишних ререндеров
export default React.memo(ChatListItem, (prevProps, nextProps) => {
  // Кастомная функция сравнения для оптимизации
  return (
    prevProps.chat.id === nextProps.chat.id &&
    prevProps.chat.unread_count === nextProps.chat.unread_count &&
    prevProps.chat.last_message_at === nextProps.chat.last_message_at &&
    prevProps.chat.status === nextProps.chat.status &&
    prevProps.chat.priority === nextProps.chat.priority &&
    prevProps.chat.last_message?.id === nextProps.chat.last_message?.id &&
    prevProps.chat.last_message?.body === nextProps.chat.last_message?.body &&
    JSON.stringify(prevProps.chat.metadata) === JSON.stringify(nextProps.chat.metadata) &&
    prevProps.chat.active_sla_violation === nextProps.chat.active_sla_violation
  );
});

