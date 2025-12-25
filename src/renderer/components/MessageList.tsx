import React, { useEffect, useRef } from 'react';
import { Message } from '../types';
import MessageItem from './MessageItem';
import '../styles/MessageList.css';

interface MessageListProps {
  messages: Message[];
  onUpdate?: () => void;
}

const MessageList: React.FC<MessageListProps> = ({ messages, onUpdate }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  console.log('💬 MessageList rendered with messages:', messages.length);
  console.log('💬 Messages data:', messages);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    <div className="message-list">
      {pinnedMessages.length > 0 && (
        <div className="pinned-messages-section">
          <div className="pinned-messages-header">
            <span className="pinned-messages-title">📌 Закріплені повідомлення</span>
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
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;

