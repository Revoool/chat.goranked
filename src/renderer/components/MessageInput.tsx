import React, { useState, useRef, useEffect } from 'react';
import QuickReplies from './QuickReplies';
import EmojiPicker from './EmojiPicker';
import { apiClient } from '../api/client';
import '../styles/MessageInput.css';

interface MessageInputProps {
  onSend: (text: string, attachments: any[]) => void;
  disabled?: boolean;
  chatId?: number;
}

const MessageInput: React.FC<MessageInputProps> = ({ onSend, disabled, chatId }) => {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<any[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [sendMessageKey, setSendMessageKey] = useState<'enter' | 'ctrl-enter'>(
    (localStorage.getItem('settings.sendMessageKey') as 'enter' | 'ctrl-enter') || 'enter'
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const quickRepliesButtonRef = useRef<HTMLButtonElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingTimeRef = useRef<number>(0);

  // Listen for settings changes
  React.useEffect(() => {
    const handleStorageChange = () => {
      const newKey = (localStorage.getItem('settings.sendMessageKey') as 'enter' | 'ctrl-enter') || 'enter';
      setSendMessageKey(newKey);
    };
    
    window.addEventListener('storage', handleStorageChange);
    // Also check periodically (for same-tab updates)
    const interval = setInterval(() => {
      const newKey = (localStorage.getItem('settings.sendMessageKey') as 'enter' | 'ctrl-enter') || 'enter';
      if (newKey !== sendMessageKey) {
        setSendMessageKey(newKey);
      }
    }, 500);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [sendMessageKey]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() || attachments.length > 0) {
      onSend(text.trim(), attachments);
      setText('');
      setAttachments([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (sendMessageKey === 'enter') {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e);
      }
    } else {
      if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        handleSubmit(e);
      }
    }
  };

  // Handle typing indicator
  useEffect(() => {
    if (!chatId) return;

    const handleTyping = async () => {
      const now = Date.now();
      // Throttle typing indicator to avoid too many requests
      if (now - lastTypingTimeRef.current < 2000) {
        return;
      }
      lastTypingTimeRef.current = now;

      try {
        await apiClient.sendTyping(chatId, true);
      } catch (error) {
        console.warn('Failed to send typing indicator:', error);
      }

      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Send false after 3 seconds of inactivity
      typingTimeoutRef.current = setTimeout(async () => {
        try {
          await apiClient.sendTyping(chatId, false);
        } catch (error) {
          console.warn('Failed to send typing stop:', error);
        }
      }, 3000);
    };

    if (text.trim()) {
      handleTyping();
    }

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [text, chatId]);

  const handleQuickReplySelect = (replyText: string) => {
    setText(replyText);
    setShowQuickReplies(false);
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    const cursorPosition = textareaRef.current?.selectionStart || text.length;
    const newText = text.slice(0, cursorPosition) + emoji + text.slice(cursorPosition);
    setText(newText);
    if (textareaRef.current) {
      textareaRef.current.focus();
      // Устанавливаем курсор после вставленного эмодзи
      setTimeout(() => {
        if (textareaRef.current) {
          const newPosition = cursorPosition + emoji.length;
          textareaRef.current.setSelectionRange(newPosition, newPosition);
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
      }, 0);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      // TODO: Upload files and get attachment IDs
      // For now, just add file info
      Array.from(files).forEach((file) => {
        setAttachments((prev) => [...prev, { filename: file.name, file }]);
      });
    }
  };

  return (
    <form className="message-input" onSubmit={handleSubmit}>
      {attachments.length > 0 && (
        <div className="message-input-attachments">
          {attachments.map((att, idx) => (
            <div key={idx} className="attachment-preview">
              <span>{att.filename}</span>
              <button
                type="button"
                onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="message-input-container">
        <div className="message-input-buttons-group">
          <button
            type="button"
            className="message-input-attach"
            onClick={() => document.getElementById('file-input')?.click()}
            title="Прикріпити файл"
          >
            📎
          </button>
          <input
            id="file-input"
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
          {chatId && (
            <div className="message-input-quickreplies-wrapper" style={{ position: 'relative' }}>
              <button
                ref={quickRepliesButtonRef}
                type="button"
                className="message-input-quickreplies-btn"
                onClick={() => {
                  setShowQuickReplies(!showQuickReplies);
                  setShowEmojiPicker(false);
                }}
                title="Швидкі відповіді"
              >
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M10 2L3 7V18H8V12H12V18H17V7L10 2Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
              </button>
              {showQuickReplies && (
                <QuickReplies 
                  onSelect={handleQuickReplySelect}
                />
              )}
            </div>
          )}
          <div className="message-input-emoji-wrapper" style={{ position: 'relative' }}>
            <button
              ref={emojiButtonRef}
              type="button"
              className="message-input-emoji-btn"
              onClick={() => {
                setShowEmojiPicker(!showEmojiPicker);
                setShowQuickReplies(false);
              }}
              title="Смайлики"
            >
              😊
            </button>
            {showEmojiPicker && (
              <EmojiPicker
                onSelect={handleEmojiSelect}
                onClose={() => setShowEmojiPicker(false)}
              />
            )}
          </div>
        </div>
        <textarea
          ref={textareaRef}
          className="message-input-textarea"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = `${e.target.scrollHeight}px`;
          }}
          onKeyDown={handleKeyDown}
          placeholder={sendMessageKey === 'enter'
            ? 'Введіть повідомлення... (Enter для відправки, Shift+Enter для нового рядка)'
            : 'Введіть повідомлення... (Ctrl+Enter для відправки, Enter для нового рядка)'}
          rows={1}
          disabled={disabled}
        />
        <button
          type="submit"
          className="message-input-send"
          disabled={disabled || (!text.trim() && attachments.length === 0)}
        >
          Відправити
        </button>
      </div>
    </form>
  );
};

export default MessageInput;

