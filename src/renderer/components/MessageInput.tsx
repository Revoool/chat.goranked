import React, { useState, useRef, useEffect } from 'react';
import QuickReplies from './QuickReplies';
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
  const [sendMessageKey, setSendMessageKey] = useState<'enter' | 'ctrl-enter'>(
    (localStorage.getItem('settings.sendMessageKey') as 'enter' | 'ctrl-enter') || 'enter'
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
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
      {chatId && <QuickReplies onSelect={handleQuickReplySelect} />}
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
        <button
          type="button"
          className="message-input-attach"
          onClick={() => document.getElementById('file-input')?.click()}
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
            ? 'Введите сообщение... (Enter для отправки, Shift+Enter для новой строки)'
            : 'Введите сообщение... (Ctrl+Enter для отправки, Enter для новой строки)'}
          rows={1}
          disabled={disabled}
        />
        <button
          type="submit"
          className="message-input-send"
          disabled={disabled || (!text.trim() && attachments.length === 0)}
        >
          Отправить
        </button>
      </div>
    </form>
  );
};

export default MessageInput;

