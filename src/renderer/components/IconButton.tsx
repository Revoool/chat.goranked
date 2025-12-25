import React from 'react';
import '../styles/IconButton.css';

interface IconButtonProps {
  icon: React.ReactNode;
  onClick: () => void;
  title: string;
  className?: string;
  active?: boolean;
  disabled?: boolean;
}

const IconButton: React.FC<IconButtonProps> = ({ 
  icon, 
  onClick, 
  title, 
  className = '', 
  active = false,
  disabled = false 
}) => {
  return (
    <div className="icon-button-wrapper">
      <button
        className={`icon-button ${className} ${active ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={onClick}
        disabled={disabled}
        title={title}
      >
        {icon}
      </button>
      <div className="icon-button-tooltip">{title}</div>
    </div>
  );
};

export default IconButton;

