import React, { useEffect, useRef } from 'react';
import { Message } from '../types';
import { IconPin } from '@tabler/icons-react';
import MessageItem from './MessageItem';
import '../styles/MessageList.css';

interface MessageListProps {
  messages: Message[];
  onUpdate?: () => void;
}

const MessageList: React.FC<MessageListProps> = ({ messages, onUpdate }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);

  console.log('💬 MessageList rendered with messages:', messages.length);
  console.log('💬 Messages data:', messages);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (!messages || messages.length === 0) return;

    const scrollToBottom = () => {
      const container = messageListRef.current;
      const endMarker = messagesEndRef.current;
      
      if (!container || !endMarker) return;

      // Use multiple methods to ensure we scroll to the very bottom
      // Method 1: scrollIntoView with instant behavior (more reliable)
      endMarker.scrollIntoView({ behavior: 'auto', block: 'end' });
      
      // Method 2: Direct scrollTop manipulation (fallback)
      requestAnimationFrame(() => {
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      });
      
      // Method 3: Double-check after a short delay (for async content)
      setTimeout(() => {
        if (container && endMarker) {
          endMarker.scrollIntoView({ behavior: 'auto', block: 'end' });
          container.scrollTop = container.scrollHeight;
        }
      }, 100);
    };

    // For initial load, wait a bit longer to ensure all content is rendered
    if (isInitialLoad.current && messages.length > 0) {
      isInitialLoad.current = false;
      // Wait for DOM to fully render
      setTimeout(scrollToBottom, 200);
      // Also try after a longer delay for very long message lists
      setTimeout(scrollToBottom, 500);
    } else {
      // For subsequent updates, scroll immediately
      scrollToBottom();
    }
  }, [messages]);

  if (!messages || messages.length === 0) {
    return (
      <div className="message-list">
        <div className="message-list-empty">Нет сообщений</div>
      </div>
    );
  }

  // Separate pinned and regular messages
  const pinnedMessages = messages.filter(msg => msg.pinned);
  const regularMessages = messages.filter(msg => !msg.pinned);

  return (
    <div className="message-list" ref={messageListRef}>
      {pinnedMessages.length > 0 && (
        <div className="pinned-messages-section">
          <div className="pinned-messages-header">
            <span className="pinned-messages-title">
              <IconPin size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
              Закріплені повідомлення
            </span>
          </div>
          <div className="pinned-messages-list">
            {pinnedMessages.map((message) => (
              <MessageItem key={message.id} message={message} onUpdate={onUpdate} />
            ))}
          </div>
        </div>
      )}
      {regularMessages.map((message) => (
        <MessageItem key={message.id} message={message} onUpdate={onUpdate} />
      ))}
      <div ref={messagesEndRef} style={{ height: '1px' }} />
    </div>
  );
};

export default MessageList;

