import React, { useEffect, useRef } from 'react';
import { Message } from '../types';
import MessageItem from './MessageItem';
import '../styles/MessageList.css';

interface MessageListProps {
  messages: Message[];
}

const MessageList: React.FC<MessageListProps> = ({ messages }) => {
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

  return (
    <div className="message-list">
      {messages.map((message) => (
        <MessageItem key={message.id} message={message} />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;

