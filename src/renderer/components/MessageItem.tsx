import React from 'react';
import { Message } from '../types';
import '../styles/MessageItem.css';

interface MessageItemProps {
  message: Message;
}

const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
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

  return (
    <div className={`message-item ${isClient ? 'message-item-client' : 'message-item-agent'}`}>
      <div className="message-content">
        {!isClient && (
          <div className="message-author">{authorName}</div>
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
        </div>
      </div>
    </div>
  );
};

export default MessageItem;

