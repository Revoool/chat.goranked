import React, { useEffect, useRef } from 'react';
import { Message } from '../../types';
import { IconPin } from '../../icons';
import MessageItem from './MessageItem';
import TypingIndicator from '../common/TypingIndicator';
import { useChatStore } from '../../store/chatStore';
import '../../styles/MessageList.css';

interface MessageListProps {
  messages: Message[];
  chatId: number | string;
  onUpdate?: () => void;
  searchQuery?: string;
}

const MessageList: React.FC<MessageListProps> = ({ messages, chatId, onUpdate, searchQuery = '' }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);
  const prevMessagesLength = useRef(0);
  const typingIndicators = useChatStore((state) => state.typingIndicators);
  const typingInfo = typingIndicators[chatId];

  // Оптимизированный scroll - убрали лишние requestAnimationFrame для снижения нагрузки на GPU
  useEffect(() => {
    const scrollToBottom = () => {
      const container = messageListRef.current;
      const endMarker = messagesEndRef.current;
      
      if (!container || !endMarker) return;

      // Используем прямой scroll вместо requestAnimationFrame для лучшей производительности
      // requestAnimationFrame может вызывать проблемы с GPU при частых вызовах
      container.scrollTop = container.scrollHeight;
    };

    if (!messages || messages.length === 0) {
      // Scroll even if no messages but typing indicator is shown
      if (typingInfo?.isTyping) {
        setTimeout(scrollToBottom, 50);
      }
      return;
    }

    // Only scroll if new messages were added (not on initial render or when messages decrease)
    const hasNewMessages = messages.length > prevMessagesLength.current;
    prevMessagesLength.current = messages.length;

    if (!hasNewMessages && !isInitialLoad.current && !typingInfo?.isTyping) {
      return; // Don't scroll if messages were removed or filtered
    }

    // For initial load, wait a bit longer to ensure all content is rendered
    if (isInitialLoad.current && messages.length > 0) {
      isInitialLoad.current = false;
      setTimeout(scrollToBottom, 50);
    } else if (hasNewMessages || typingInfo?.isTyping) {
      // For new messages or typing indicator, scroll immediately
      scrollToBottom();
    }
  }, [messages, typingInfo]);

  if (!messages || messages.length === 0) {
    return (
      <div className="message-list">
        <div className="message-list-empty">Нет сообщений</div>
      </div>
    );
  }

  // Separate pinned and regular messages (memoized for performance)
  const { pinnedMessages, regularMessages } = React.useMemo(() => {
    const pinned: Message[] = [];
    const regular: Message[] = [];
    
    messages.forEach(msg => {
      if (msg.pinned) {
        pinned.push(msg);
      } else {
        regular.push(msg);
      }
    });
    
    return { pinnedMessages: pinned, regularMessages: regular };
  }, [messages]);

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
              <MessageItem key={message.id} message={message} onUpdate={onUpdate} searchQuery={searchQuery} />
            ))}
          </div>
        </div>
      )}
      {regularMessages.map((message) => (
        <MessageItem key={message.id} message={message} onUpdate={onUpdate} searchQuery={searchQuery} />
      ))}
      {typingInfo?.isTyping && (
        <TypingIndicator userName={typingInfo.userName} />
      )}
      <div ref={messagesEndRef} style={{ height: '1px' }} />
    </div>
  );
};

export default MessageList;

