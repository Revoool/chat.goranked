import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../types';
import { apiClient } from '../api/client';
import '../styles/MessageItem.css';

interface MessageItemProps {
  message: Message;
  onUpdate?: () => void;
}

const MessageItem: React.FC<MessageItemProps> = ({ message, onUpdate }) => {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [isPinning, setIsPinning] = useState(false);
  const [isMarkingUnread, setIsMarkingUnread] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);

  // API uses from_manager (boolean) - true if from manager, false if from client
  const messageText = message.body || '';
  const messageType = message.type || 'text';
  
  // Determine if message is from client (from_manager === false)
  const isClient = !message.from_manager;

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const authorName = message.user?.name || 'Agent';
  const authorAvatar = message.user?.avatar;

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(event.target as Node) &&
        messageRef.current &&
        !messageRef.current.contains(event.target as Node)
      ) {
        setShowContextMenu(false);
      }
    };

    if (showContextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showContextMenu]);

  const handlePinMessage = async () => {
    if (isPinning) return;
    setIsPinning(true);
    try {
      if (message.pinned) {
        await apiClient.unpinMessage(message.chat_id, message.id);
      } else {
        await apiClient.pinMessage(message.chat_id, message.id);
      }
      setShowContextMenu(false);
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error pinning/unpinning message:', error);
    } finally {
      setIsPinning(false);
    }
  };

  const handleMarkAsUnread = async () => {
    if (isMarkingUnread) return;
    setIsMarkingUnread(true);
    try {
      await apiClient.markMessageAsUnread(message.chat_id, message.id);
      setShowContextMenu(false);
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error marking message as unread:', error);
    } finally {
      setIsMarkingUnread(false);
    }
  };

  return (
    <div 
      ref={messageRef}
      className={`message-item ${isClient ? 'message-item-client' : 'message-item-agent'} ${message.pinned ? 'message-pinned' : ''} ${message.unread ? 'message-unread' : ''}`}
      onContextMenu={(e) => {
        e.preventDefault();
        setShowContextMenu(true);
      }}
    >
      <div className="message-content">
        {message.pinned && (
          <div className="message-pinned-badge" title="Закріплено">
            📌
          </div>
        )}
        {!isClient && (
          <div className="message-author">
            {authorAvatar && (
              <img 
                src={authorAvatar} 
                alt={authorName}
                className="message-author-avatar"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
            <span>{authorName}</span>
          </div>
        )}
        <div className="message-bubble">
          <div className="message-text">{messageText}</div>
          {message.files && message.files.length > 0 && (
            <div className="message-attachments">
              {message.files.map((file) => (
                <div key={file.id} className="message-attachment">
                  {file.mime_type.startsWith('image/') ? (
                    <img src={file.file_path} alt={file.file_name} />
                  ) : (
                    <a href={file.file_path} target="_blank" rel="noopener noreferrer">
                      📎 {file.file_name}
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="message-meta">
          <span className="message-time">{formatTime(message.created_at)}</span>
          {!isClient && message.seen && (
            <span className="message-read">✓✓</span>
          )}
          {message.unread && (
            <span className="message-unread-badge" title="Непрочитане">🔴</span>
          )}
        </div>
      </div>
      {showContextMenu && (
        <div ref={contextMenuRef} className="message-context-menu">
          <button
            className="context-menu-item"
            onClick={handlePinMessage}
            disabled={isPinning}
          >
            {message.pinned ? '📌 Відкріпити' : '📌 Закріпити'}
          </button>
          <button
            className="context-menu-item"
            onClick={handleMarkAsUnread}
            disabled={isMarkingUnread}
          >
            🔴 Позначити як непрочитане
          </button>
        </div>
      )}
    </div>
  );
};

export default MessageItem;

