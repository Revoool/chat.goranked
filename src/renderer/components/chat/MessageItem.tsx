import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../../types';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { useQueryClient } from '@tanstack/react-query';
import { IconPin, IconCircleDot, IconPencil, IconPaperclip, IconCheck, IconSparkles } from '../../icons';
import ImageModal from './modals/ImageModal';
import '../../styles/MessageItem.css';

interface MessageItemProps {
  message: Message;
  onUpdate?: () => void;
  searchQuery?: string;
}

const MessageItem: React.FC<MessageItemProps> = ({ message, onUpdate, searchQuery = '' }) => {
  const { user: currentUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [isPinning, setIsPinning] = useState(false);
  const [isMarkingUnread, setIsMarkingUnread] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.body || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ url: string; name: string } | null>(null);
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
  
  // Check if message is from AI suggestion
  const isAiSuggestion = message.metadata?.from_ai_suggestion === true;
  const aiSuggestionIndex = message.metadata?.ai_suggestion_index;
  const wasAiEdited = message.metadata?.was_edited === true;

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
  // Обрабатываем avatar - может быть строкой или null/undefined
  const authorAvatar = message.user?.avatar 
    ? (typeof message.user.avatar === 'string' && message.user.avatar.trim() !== '' 
      ? message.user.avatar 
      : null)
    : null;

  // Функция для подсветки найденного текста (находит все совпадения)
  const highlightText = (text: string, query: string): React.ReactNode => {
    // Защита от пустых значений
    if (!text || typeof text !== 'string') {
      return text || '';
    }
    
    if (!query || typeof query !== 'string' || !query.trim()) {
      return text;
    }

    const queryTrimmed = query.trim();
    if (queryTrimmed.length === 0) {
      return text;
    }

    const queryLower = queryTrimmed.toLowerCase();
    const textLower = text.toLowerCase();
    const parts: Array<string | { text: string; isMatch: boolean }> = [];
    let lastIndex = 0;
    let index = textLower.indexOf(queryLower, lastIndex);
    let iterations = 0;
    const maxIterations = 1000; // Защита от бесконечного цикла

    while (index !== -1 && iterations < maxIterations) {
      iterations++;
      // Добавляем текст до совпадения
      if (index > lastIndex) {
        parts.push(text.substring(lastIndex, index));
      }
      // Добавляем совпадение
      parts.push({ text: text.substring(index, index + queryTrimmed.length), isMatch: true });
      lastIndex = index + queryTrimmed.length;
      index = textLower.indexOf(queryLower, lastIndex);
    }

    // Добавляем оставшийся текст
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    // Если совпадений не найдено, возвращаем исходный текст
    if (parts.length === 0) {
      return text;
    }
    
    // Если только один элемент и это строка (без совпадений), возвращаем её
    if (parts.length === 1 && typeof parts[0] === 'string') {
      return parts[0];
    }

    // Рендерим части с подсветкой
    return (
      <>
        {parts.map((part, idx) => {
          if (typeof part === 'string') {
            return <React.Fragment key={idx}>{part}</React.Fragment>;
          } else {
            return (
              <mark key={idx} className="message-search-highlight">
                {part.text}
              </mark>
            );
          }
        })}
      </>
    );
  };

  // Мемоизируем результат подсветки, чтобы избежать лишних ререндеров
  // Используем message.body напрямую, чтобы избежать лишних пересчетов
  const highlightedText = React.useMemo(() => {
    const text = message.body || '';
    return highlightText(text, searchQuery);
  }, [message.body, searchQuery]);

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
            <div className="message-author-avatar-wrapper">
              {authorAvatar ? (
                <img 
                  src={authorAvatar} 
                  alt={authorName}
                  className="message-author-avatar"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="message-author-avatar-placeholder">
                  {authorName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
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
              >{highlightedText}</div>
              {message.files && message.files.length > 0 && (
                <div className="message-attachments">
                  {message.files.map((file) => {
                    // Security: Use API endpoint for file access instead of direct file_path
                    // This ensures server-side authorization checks
                    const fileUrl = (file.file_path && typeof file.file_path === 'string' && file.file_path.startsWith('http')) 
                      ? file.file_path 
                      : `/api/manager-client-chats/${message.chat_id}/messages/${message.id}/files/${file.id}`;
                    
                    return (
                      <div key={file.id} className="message-attachment">
                        {file.mime_type.startsWith('image/') ? (
                          <img 
                            src={fileUrl} 
                            alt={file.file_name || 'Attachment'} 
                            crossOrigin="anonymous"
                            onClick={() => setSelectedImage({ url: fileUrl, name: file.file_name || 'Image' })}
                            style={{ cursor: 'pointer' }}
                          />
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
          {!isClient && isAiSuggestion && (
            <div className="message-ai-indicator" title={wasAiEdited ? `AI-ответ (вариант ${aiSuggestionIndex !== undefined ? aiSuggestionIndex + 1 : '?'}), отредактирован` : `AI-ответ (вариант ${aiSuggestionIndex !== undefined ? aiSuggestionIndex + 1 : '?'}), без редактирования`}>
              <IconSparkles size={14} className={wasAiEdited ? 'ai-edited' : 'ai-pure'} />
              {aiSuggestionIndex !== undefined && (
                <span className="ai-variant-badge">{aiSuggestionIndex + 1}</span>
              )}
            </div>
          )}
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
      {selectedImage && (
        <ImageModal
          imageUrl={selectedImage.url}
          imageName={selectedImage.name}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </div>
  );
};

// Мемоизируем компонент для предотвращения лишних ререндеров
export default React.memo(MessageItem, (prevProps, nextProps) => {
  // Кастомная функция сравнения для оптимизации
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.body === nextProps.message.body &&
    prevProps.message.pinned === nextProps.message.pinned &&
    prevProps.message.unread === nextProps.message.unread &&
    prevProps.message.created_at === nextProps.message.created_at &&
    prevProps.searchQuery === nextProps.searchQuery &&
    JSON.stringify(prevProps.message.metadata) === JSON.stringify(nextProps.message.metadata) &&
    JSON.stringify(prevProps.message.files) === JSON.stringify(nextProps.message.files)
  );
});

