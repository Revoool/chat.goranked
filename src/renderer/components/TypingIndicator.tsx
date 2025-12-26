import React from 'react';
import '../styles/TypingIndicator.css';

interface TypingIndicatorProps {
  userName: string | null;
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ userName }) => {
  return (
    <div className="typing-indicator-container">
      <div className="typing-indicator-bubble">
        <div className="typing-indicator-content">
          <div className="typing-indicator-dots">
            <span className="typing-dot"></span>
            <span className="typing-dot"></span>
            <span className="typing-dot"></span>
          </div>
          <span className="typing-indicator-text">
            {userName ? `${userName} друкує повідомлення...` : 'Друкує повідомлення...'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;

