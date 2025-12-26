import React, { useEffect, useRef } from 'react';
import { Message } from '../types';
import { IconPin } from '../icons';
import MessageItem from './MessageItem';
import TypingIndicator from './TypingIndicator';
import { useChatStore } from '../store/chatStore';
import '../styles/MessageList.css';

interface MessageListProps {
  messages: Message[];
  chatId: number;
  onUpdate?: () => void;
}

const MessageList: React.FC<MessageListProps> = ({ messages, chatId, onUpdate }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);
  const prevMessagesLength = useRef(0);
  const typingIndicators = useChatStore((state) => state.typingIndicators);
  const typingInfo = typingIndicators[chatId];

  // Scroll to bottom when messages change or typing indicator appears
  useEffect(() => {
    const scrollToBottom = () => {
      const container = messageListRef.current;
      const endMarker = messagesEndRef.current;
      
      if (!container || !endMarker) return;

      // Use requestAnimationFrame for smooth scrolling
      requestAnimationFrame(() => {
        endMarker.scrollIntoView({ behavior: 'smooth', block: 'end' });
        container.scrollTop = container.scrollHeight;
      });
    };

    if (!messages || messages.length === 0) {
      // Scroll even if no messages but typing indicator is shown
      if (typingInfo?.isTyping) {
        setTimeout(scrollToBottom, 100);
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
      setTimeout(scrollToBottom, 100);
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
              <MessageItem key={message.id} message={message} onUpdate={onUpdate} />
            ))}
          </div>
        </div>
      )}
      {regularMessages.map((message) => (
        <MessageItem key={message.id} message={message} onUpdate={onUpdate} />
      ))}
      {typingInfo?.isTyping && (
        <TypingIndicator userName={typingInfo.userName} />
      )}
      <div ref={messagesEndRef} style={{ height: '1px' }} />
    </div>
  );
};

export default MessageList;

