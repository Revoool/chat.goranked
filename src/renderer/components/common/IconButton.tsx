import React, { useRef, useState, useEffect } from 'react';
import '../../styles/IconButton.css';

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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipPosition, setTooltipPosition] = useState<'top' | 'bottom'>('top');
  const [tooltipAlign, setTooltipAlign] = useState<'center' | 'left' | 'right'>('center');

  useEffect(() => {
    const updateTooltipPosition = () => {
      if (!wrapperRef.current || !tooltipRef.current) return;

      const wrapperRect = wrapperRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Проверяем, помещается ли тултип сверху
      if (wrapperRect.top < tooltipRect.height + 10) {
        setTooltipPosition('bottom');
      } else {
        setTooltipPosition('top');
      }

      // Проверяем горизонтальное позиционирование
      const centerX = wrapperRect.left + wrapperRect.width / 2;
      const tooltipWidth = tooltipRect.width;

      if (centerX + tooltipWidth / 2 > viewportWidth - 10) {
        setTooltipAlign('right');
      } else if (centerX - tooltipWidth / 2 < 10) {
        setTooltipAlign('left');
      } else {
        setTooltipAlign('center');
      }
    };

    // Обновляем позицию при наведении
    const handleMouseEnter = () => {
      setTimeout(updateTooltipPosition, 0);
    };

    const wrapper = wrapperRef.current;
    if (wrapper) {
      wrapper.addEventListener('mouseenter', handleMouseEnter);
      return () => {
        wrapper.removeEventListener('mouseenter', handleMouseEnter);
      };
    }
  }, []);

  return (
    <div className="icon-button-wrapper" ref={wrapperRef}>
      <button
        className={`icon-button ${className} ${active ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={onClick}
        disabled={disabled}
        title={title}
      >
        {icon}
      </button>
      <div 
        ref={tooltipRef}
        className={`icon-button-tooltip icon-button-tooltip-${tooltipPosition} icon-button-tooltip-${tooltipAlign}`}
      >
        {title}
      </div>
    </div>
  );
};

export default IconButton;
