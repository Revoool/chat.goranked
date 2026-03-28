import React, { useState, useRef, useEffect } from 'react';
import QuickReplies from './QuickReplies';
import AiSuggestions from './AiSuggestions';
import EmojiPicker from '../common/EmojiPicker';
import { IconMoodSmile, IconLanguage } from '../../icons';
import { apiClient } from '../../api/client';
import '../../styles/MessageInput.css';

interface MessageInputProps {
  onSend: (text: string, attachments: any[], metadata?: any) => void;
  onSendPayment?: (payload: { url: string; label?: string; caption?: string }) => void;
  disabled?: boolean;
  chatId?: number;
}

const MessageInput: React.FC<MessageInputProps> = ({ onSend, onSendPayment, disabled, chatId }) => {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<any[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showAiSuggestions, setShowAiSuggestions] = useState(false);
  const [selectedAiSuggestion, setSelectedAiSuggestion] = useState<{text: string, index: number, aiRunId?: number} | null>(null);
  const [sendMessageKey, setSendMessageKey] = useState<'enter' | 'ctrl-enter'>(
    (localStorage.getItem('settings.sendMessageKey') as 'enter' | 'ctrl-enter') || 'enter'
  );
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState('');
  const [paymentLabel, setPaymentLabel] = useState('');
  const [paymentCaption, setPaymentCaption] = useState('');
  const [draftEnPreview, setDraftEnPreview] = useState<string | null>(null);
  const [draftEnLoading, setDraftEnLoading] = useState(false);
  const [draftEnError, setDraftEnError] = useState<string | null>(null);
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

  // Function to focus textarea
  const focusTextarea = React.useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  // Restore focus after message is sent (when text becomes empty)
  useEffect(() => {
    if (!text && !disabled && textareaRef.current) {
      // Use microtask to ensure this runs after React's state updates
      Promise.resolve().then(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      });
    }
  }, [text, disabled]);

  // Clear text and attachments when chatId changes (fixes bug #1)
  useEffect(() => {
    setText('');
    setAttachments([]);
    setSelectedAiSuggestion(null);
    setShowPaymentModal(false);
    setPaymentUrl('');
    setPaymentLabel('');
    setPaymentCaption('');
    setDraftEnPreview(null);
    setDraftEnError(null);
    setDraftEnLoading(false);
  }, [chatId]);

  // Ensure focus when component mounts or chatId changes
  useEffect(() => {
    if (!disabled && textareaRef.current) {
      // Small delay to ensure DOM is ready
      const timeoutId = setTimeout(() => {
        focusTextarea();
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [chatId, disabled, focusTextarea]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() || attachments.length > 0) {
      // Stop typing indicator when sending message
      if (chatId && typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
        apiClient.sendTyping(chatId, false).catch(err => {
          console.warn('Failed to stop typing indicator:', err);
        });
      }
      const messageText = text.trim();
      const messageAttachments = [...attachments];
      
      // Prepare metadata if AI suggestion was used
      const metadata = selectedAiSuggestion ? {
        from_ai_suggestion: true,
        ai_suggestion_index: selectedAiSuggestion.index,
        original_ai_suggestion: selectedAiSuggestion.text,
        was_edited: messageText !== selectedAiSuggestion.text,
        ai_run_id: selectedAiSuggestion.aiRunId, // Для связи с feedback
      } : undefined;
      
      onSend(messageText, messageAttachments, metadata);
      setText('');
      setAttachments([]);
      setSelectedAiSuggestion(null);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      // Focus will be restored by useEffect when text becomes empty
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

  const submitPaymentLink = () => {
    if (!onSendPayment) return;
    const u = paymentUrl.trim();
    if (!u) return;
    let parsed: URL;
    try {
      parsed = new URL(u);
    } catch {
      alert('Некоректна адреса посилання');
      return;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      alert('Дозволені лише посилання http або https');
      return;
    }
    onSendPayment({
      url: u,
      label: paymentLabel.trim() || undefined,
      caption: paymentCaption.trim() || undefined,
    });
    setShowPaymentModal(false);
    setPaymentUrl('');
    setPaymentLabel('');
    setPaymentCaption('');
  };

  const handleQuickReplySelect = (replyText: string) => {
    setText(replyText);
    setShowQuickReplies(false);
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const handleTranslateToEn = async () => {
    if (!chatId || !text.trim() || draftEnLoading) return;
    setDraftEnError(null);
    setDraftEnLoading(true);
    try {
      const res = await apiClient.translateDraft(chatId, text.trim());
      if (res?.success && res.data?.translated_text) {
        setDraftEnPreview(res.data.translated_text);
      } else {
        setDraftEnError(res?.error || 'Не вдалося перекласти');
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      const msg = err?.response?.data?.error || err?.message || 'Помилка перекладу';
      setDraftEnError(typeof msg === 'string' ? msg : 'Помилка перекладу');
    } finally {
      setDraftEnLoading(false);
    }
  };

  const handleAiSuggestionSelect = (suggestion: string, index: number, aiRunId?: number) => {
    setText(suggestion);
    setSelectedAiSuggestion({ text: suggestion, index, aiRunId });
    setShowAiSuggestions(false);
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
      // Add file info with preview for images
      Array.from(files).forEach((file) => {
        const attachment: any = { filename: file.name, file };
        
        // Add attachment immediately
        setAttachments((prev) => {
          // Check if file already exists
          if (!prev.some(att => att.filename === file.name && att.file === file)) {
            return [...prev, attachment];
          }
          return prev;
        });
        
        // Create preview for images
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const preview = event.target?.result as string;
            setAttachments((prev) => {
              return prev.map((att) => 
                att.filename === file.name && att.file === file 
                  ? { ...att, preview }
                  : att
              );
            });
          };
          reader.onerror = () => {
            console.warn('Failed to read image file for preview');
          };
          reader.readAsDataURL(file);
        }
      });
    }
    // Reset input to allow selecting the same file again
    e.target.value = '';
  };

  return (
    <div className="message-input-wrapper">
      {showPaymentModal && onSendPayment && (
        <div
          className="payment-link-modal-overlay"
          role="presentation"
          onClick={() => setShowPaymentModal(false)}
        >
          <div
            className="payment-link-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-link-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="payment-link-title" className="payment-link-modal-title">
              Посилання на оплату
            </h3>
            <p className="payment-link-modal-hint">
              Клієнт побачить кнопку оплати у віджеті на сайті замість довгого URL.
            </p>
            <label className="payment-link-field">
              <span>Посилання (https://…)</span>
              <input
                type="url"
                value={paymentUrl}
                onChange={(e) => setPaymentUrl(e.target.value)}
                placeholder="https://…"
                autoFocus
              />
            </label>
            <label className="payment-link-field">
              <span>Текст кнопки (необов&apos;язково)</span>
              <input
                type="text"
                value={paymentLabel}
                onChange={(e) => setPaymentLabel(e.target.value)}
                placeholder="Оплатити"
              />
            </label>
            <label className="payment-link-field">
              <span>Коментар над кнопкою (необов&apos;язково)</span>
              <textarea
                value={paymentCaption}
                onChange={(e) => setPaymentCaption(e.target.value)}
                rows={2}
              />
            </label>
            <div className="payment-link-modal-actions">
              <button type="button" className="payment-link-btn-cancel" onClick={() => setShowPaymentModal(false)}>
                Скасувати
              </button>
              <button
                type="button"
                className="payment-link-btn-submit"
                disabled={!paymentUrl.trim()}
                onClick={submitPaymentLink}
              >
                Надіслати
              </button>
            </div>
          </div>
        </div>
      )}
      {showAiSuggestions && chatId && (
        <AiSuggestions
          chatId={chatId}
          onSelect={handleAiSuggestionSelect}
          onClose={() => setShowAiSuggestions(false)}
        />
      )}
      {draftEnError && (
        <div className="message-input-en-error" role="alert">
          {draftEnError}
        </div>
      )}
      {draftEnPreview !== null && (
        <div className="message-input-en-preview" role="region" aria-label="Переклад чернетки англійською">
          <div className="message-input-en-preview-label">English (preview)</div>
          <p className="message-input-en-preview-text">{draftEnPreview}</p>
          <div className="message-input-en-preview-actions">
            <button
              type="button"
              className="message-input-en-preview-btn message-input-en-preview-btn--primary"
              onClick={() => {
                setText(draftEnPreview);
                setDraftEnPreview(null);
                setDraftEnError(null);
                if (textareaRef.current) {
                  textareaRef.current.focus();
                  textareaRef.current.style.height = 'auto';
                  textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
                }
              }}
            >
              Замінити чернетку
            </button>
            <button
              type="button"
              className="message-input-en-preview-btn"
              onClick={() => {
                setDraftEnPreview(null);
                setDraftEnError(null);
              }}
            >
              Скасувати
            </button>
          </div>
        </div>
      )}
      <form className="message-input" onSubmit={handleSubmit}>
        {attachments.length > 0 && (
        <div className="message-input-attachments">
          {attachments.map((att, idx) => (
            <div key={idx} className="attachment-preview">
              {att.preview && att.file?.type?.startsWith('image/') ? (
                <div className="attachment-preview-image">
                  <img src={att.preview} alt={att.filename} />
                  <button
                    type="button"
                    className="attachment-preview-remove"
                    onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                    title="Удалить"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <>
                  <span>{att.filename}</span>
                  <button
                    type="button"
                    onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    ×
                  </button>
                </>
              )}
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
            <>
              <div className="message-input-quickreplies-wrapper">
                <button
                  ref={quickRepliesButtonRef}
                  type="button"
                  className="message-input-quickreplies-btn"
                  onClick={() => {
                    setShowQuickReplies(!showQuickReplies);
                    setShowEmojiPicker(false);
                    setShowAiSuggestions(false);
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
                  <div className="quick-replies-container">
                    <QuickReplies 
                      onSelect={handleQuickReplySelect}
                    />
                  </div>
                )}
              </div>
              {onSendPayment && (
                <button
                  type="button"
                  className="message-input-payment-btn"
                  onClick={() => {
                    setShowPaymentModal(true);
                    setShowQuickReplies(false);
                    setShowEmojiPicker(false);
                    setShowAiSuggestions(false);
                  }}
                  title="Посилання на оплату"
                >
                  💳
                </button>
              )}
              <button
                type="button"
                className="message-input-translate-en-btn"
                disabled={disabled || !text.trim() || draftEnLoading}
                onClick={() => {
                  setShowAiSuggestions(false);
                  setShowEmojiPicker(false);
                  setShowQuickReplies(false);
                  handleTranslateToEn();
                }}
                title="Перекласти чернетку англійською"
              >
                {draftEnLoading ? (
                  <span className="message-input-en-spinner" aria-hidden />
                ) : (
                  <IconLanguage size={18} stroke={1.5} />
                )}
              </button>
              <button
                type="button"
                className={`message-input-ai-btn ${showAiSuggestions ? 'active' : ''}`}
                onClick={() => {
                  setShowAiSuggestions(!showAiSuggestions);
                  setShowEmojiPicker(false);
                  setShowQuickReplies(false);
                }}
                title="AI-предложения ответов"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M12 2L2 7L12 12L22 7L12 2Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                  <path
                    d="M2 17L12 22L22 17"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                  <path
                    d="M2 12L12 17L22 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
              </button>
            </>
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
              <IconMoodSmile size={20} />
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
          onCopy={(e) => {
            // Allow default copy behavior
            e.stopPropagation();
          }}
          onPaste={(e) => {
            // Allow default paste behavior
            e.stopPropagation();
          }}
          onCut={(e) => {
            // Allow default cut behavior
            e.stopPropagation();
          }}
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
          onMouseDown={(e) => {
            // Prevent button from taking focus
            e.preventDefault();
          }}
          onClick={() => {
            // Ensure textarea keeps focus immediately after click
            // Focus will be maintained by useEffect when text becomes empty
            if (textareaRef.current) {
              textareaRef.current.focus();
            }
          }}
        >
          Відправити
        </button>
      </div>
    </form>
    </div>
  );
};

export default MessageInput;

