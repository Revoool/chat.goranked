import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../types';
import { apiClient } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { useQueryClient } from '@tanstack/react-query';
import { IconPin, IconCircleDot, IconPencil, IconPaperclip, IconCheck } from '../icons';
import '../styles/MessageItem.css';

interface MessageItemProps {
  message: Message;
  onUpdate?: () => void;
}

const MessageItem: React.FC<MessageItemProps> = ({ message, onUpdate }) => {
  const { user: currentUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [isPinning, setIsPinning] = useState(false);
  const [isMarkingUnread, setIsMarkingUnread] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.body || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);

  // API uses from_manager (boolean) - true if from manager, false if from client
  const messageText = message.body || '';
  const messageType = message.type || 'text';
  
  // Determine if message is from client (from_manager === false)
  const isClient = !message.from_manager;
  
  // Check if message can be edited (only own manager messages)
  const canEdit = !isClient && currentUser && message.user_id === currentUser.id && message.type === 'text';
  
  // Check if message was edited
  const isEdited = message.metadata?.edited === true;

  // Sync editText when message.body changes (e.g., after update)
  useEffect(() => {
    if (!isEditing) {
      setEditText(message.body || '');
    }
  }, [message.body, isEditing]);

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

  const handleStartEdit = () => {
    setEditText(message.body || '');
    setIsEditing(true);
    setShowContextMenu(false);
    // Focus textarea after render
    setTimeout(() => {
      editTextareaRef.current?.focus();
      editTextareaRef.current?.select();
    }, 0);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditText(message.body || '');
  };

  const handleSaveEdit = async () => {
    if (!editText.trim() || isUpdating) return;
    
    if (editText.trim() === message.body) {
      setIsEditing(false);
      return;
    }

    setIsUpdating(true);
    try {
      const response = await apiClient.updateMessage(message.chat_id, message.id, editText.trim());
      const updatedMessage = response.data;
      
      console.log('✅ Message updated, response:', response);
      console.log('✅ Updated message data:', updatedMessage);
      
      // Optimistically update the message in React Query cache
      queryClient.setQueryData(['messages', message.chat_id], (oldData: any) => {
        const currentMessages = oldData?.data || oldData || [];
        if (!Array.isArray(currentMessages)) return oldData;
        
        const updatedMessages = currentMessages.map((msg: Message) => 
          msg.id === updatedMessage.id ? updatedMessage : msg
        );
        
        // Return in the same format as received
        if (oldData?.data) {
          return { ...oldData, data: updatedMessages };
        }
        return updatedMessages;
      });
      
      setIsEditing(false);
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error updating message:', error);
      alert('Помилка при редагуванні повідомлення');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  return (
    <div 
      ref={messageRef}
      className={`message-item ${isClient ? 'message-item-client' : 'message-item-agent'} ${message.pinned ? 'message-pinned' : ''} ${message.unread ? 'message-unread' : ''}`}
      onContextMenu={(e) => {
        // Only show custom context menu if no text is selected
        const selection = window.getSelection();
        if (!selection || selection.toString().trim().length === 0) {
          e.preventDefault();
          setShowContextMenu(true);
        }
        // If text is selected, allow default browser context menu for copy
      }}
    >
      <div className="message-content">
        {message.pinned && (
          <div className="message-pinned-badge" title="Закріплено">
            <IconPin size={14} />
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
          {isEditing ? (
            <div className="message-edit-container">
              <textarea
                ref={editTextareaRef}
                className="message-edit-textarea"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={handleEditKeyDown}
                disabled={isUpdating}
                rows={3}
              />
              <div className="message-edit-actions">
                <button
                  className="message-edit-save"
                  onClick={handleSaveEdit}
                  disabled={isUpdating || !editText.trim()}
                >
                  {isUpdating ? 'Збереження...' : 'Зберегти (Ctrl+Enter)'}
                </button>
                <button
                  className="message-edit-cancel"
                  onClick={handleCancelEdit}
                  disabled={isUpdating}
                >
                  Скасувати (Esc)
                </button>
              </div>
            </div>
          ) : (
            <>
              {canEdit && (
                <button
                  className="message-edit-button"
                  onClick={handleStartEdit}
                  title="Редагувати повідомлення"
                >
                  <IconPencil size={14} />
                </button>
              )}
              <div 
                className="message-text"
                onCopy={(e) => {
                  // Allow default copy behavior
                  e.stopPropagation();
                }}
                onPaste={(e) => {
                  // Allow default paste behavior
                  e.stopPropagation();
                }}
              >{messageText}</div>
              {message.files && message.files.length > 0 && (
                <div className="message-attachments">
                  {message.files.map((file) => {
                    // Security: Use API endpoint for file access instead of direct file_path
                    // This ensures server-side authorization checks
                    const fileUrl = file.file_path?.startsWith('http') 
                      ? file.file_path 
                      : `/api/manager-client-chats/${message.chat_id}/messages/${message.id}/files/${file.id}`;
                    
                    return (
                      <div key={file.id} className="message-attachment">
                        {file.mime_type.startsWith('image/') ? (
                          <img src={fileUrl} alt={file.file_name || 'Attachment'} crossOrigin="anonymous" />
                        ) : (
                          <a href={fileUrl} target="_blank" rel="noopener noreferrer" download={file.file_name || 'file'}>
                            <IconPaperclip size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                            {file.file_name || 'File'}
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
        <div className="message-meta">
          <span className="message-time">{formatTime(message.created_at)}</span>
          {isEdited && (
            <span className="message-edited-badge" title="Відредаговано">(ред.)</span>
          )}
          {!isClient && message.seen && (
            <span className="message-read" title="Прочитано">
              <IconCheck size={14} />
              <IconCheck size={14} style={{ marginLeft: '-4px' }} />
            </span>
          )}
          {message.unread && (
            <span className="message-unread-badge" title="Непрочитане">
              <IconCircleDot size={12} />
            </span>
          )}
        </div>
      </div>
      {showContextMenu && (
        <div ref={contextMenuRef} className="message-context-menu">
          {canEdit && (
            <button
              className="context-menu-item"
              onClick={handleStartEdit}
            >
              <IconPencil size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
              Редагувати
            </button>
          )}
          <button
            className="context-menu-item"
            onClick={handlePinMessage}
            disabled={isPinning}
          >
            <IconPin size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
            {message.pinned ? 'Відкріпити' : 'Закріпити'}
          </button>
          <button
            className="context-menu-item"
            onClick={handleMarkAsUnread}
            disabled={isMarkingUnread}
          >
            <IconCircleDot size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
            Позначити як непрочитане
          </button>
        </div>
      )}
    </div>
  );
};

export default MessageItem;

