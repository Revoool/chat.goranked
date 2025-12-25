import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import '../styles/QuickReplies.css';

interface QuickReply {
  id: number;
  key: string;
  text: string;
  translations?: Record<string, string>;
  order: number;
  active: boolean;
}

interface QuickRepliesProps {
  onSelect: (text: string) => void;
  locale?: string;
  compact?: boolean;
}

const QuickReplies: React.FC<QuickRepliesProps> = ({ onSelect, locale = 'ru', compact = false }) => {
  const [isExpanded, setIsExpanded] = useState(compact);
  const [selectedLocale, setSelectedLocale] = useState<string>(locale);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside (compact mode)
  useEffect(() => {
    if (compact && isExpanded) {
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsExpanded(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [compact, isExpanded]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['quick-replies', locale],
    queryFn: () => apiClient.getQuickReplies(locale),
    staleTime: 60 * 60 * 1000, // Cache for 1 hour
  });

  const quickReplies: QuickReply[] = data?.data || [];

  // Filter only active replies and sort by order
  const activeReplies = quickReplies
    .filter((reply) => reply.active)
    .sort((a, b) => a.order - b.order);

  // Get available languages from translations
  const availableLocales = React.useMemo(() => {
    const locales = new Set<string>();
    // Add default locale (always available)
    locales.add('ru');
    // Add all locales from translations
    activeReplies.forEach((reply) => {
      if (reply.translations) {
        Object.keys(reply.translations).forEach((lang) => locales.add(lang));
      }
    });
    return Array.from(locales).sort();
  }, [activeReplies]);

  // Initialize selectedLocale only once when availableLocales are loaded
  useEffect(() => {
    if (availableLocales.length > 0 && !availableLocales.includes(selectedLocale)) {
      // Only set if current selectedLocale is not available
      const newLocale = availableLocales.includes(locale) ? locale : availableLocales[0];
      setSelectedLocale(newLocale);
    }
    // Don't sync with prop locale after user selection - let user's choice persist
  }, [availableLocales]); // Only depend on availableLocales, not on locale or selectedLocale

  // Language names mapping
  const languageNames: Record<string, string> = {
    ru: 'Русский',
    uk: 'Українська',
    en: 'English',
  };

  const handleSelect = (reply: QuickReply) => {
    // Get text in selected locale or default text
    const text = reply.translations?.[selectedLocale] || reply.text;
    onSelect(text);
    if (compact) {
      setIsExpanded(false);
    }
  };

  if (isLoading) {
    if (compact) {
      return null;
    }
    return (
      <div className="quick-replies">
        <div className="quick-replies-loading">Завантаження швидких відповідей...</div>
      </div>
    );
  }

  if (error || activeReplies.length === 0) {
    return null; // Don't show if no replies or error
  }

  // Compact mode - only dropdown
  if (compact) {
    return (
      <div className={`quick-replies ${compact ? 'compact' : ''}`}>
        {isExpanded && (
          <div className="quick-replies-dropdown" ref={dropdownRef}>
            <div className="quick-replies-header">
              <span>Виберіть швидку відповідь</span>
              {availableLocales.length > 1 && (
                <div className="quick-replies-language-selector">
                  <label htmlFor="quick-replies-lang">Мова:</label>
                  <select
                    id="quick-replies-lang"
                    className="quick-replies-lang-select"
                    value={selectedLocale}
                    onChange={(e) => setSelectedLocale(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {availableLocales.map((lang) => (
                      <option key={lang} value={lang}>
                        {languageNames[lang] || lang.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="quick-replies-list">
              {activeReplies.map((reply) => {
                const text = reply.translations?.[selectedLocale] || reply.text;
                return (
                  <button
                    key={reply.id}
                    className="quick-reply-item"
                    onClick={() => handleSelect(reply)}
                    title={text}
                  >
                    <span className="quick-reply-text">{text}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full mode - with toggle button
  return (
    <div className="quick-replies">
      <button
        className="quick-replies-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
        title="Быстрые ответы"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M10 2L3 7V18H8V12H12V18H17V7L10 2Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
        <span>Швидкі відповіді</span>
        <svg
          className={`quick-replies-arrow ${isExpanded ? 'expanded' : ''}`}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4 6L8 10L12 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isExpanded && (
        <div className="quick-replies-dropdown">
          <div className="quick-replies-header">
            <span>Виберіть швидку відповідь</span>
            {availableLocales.length > 1 && (
              <div className="quick-replies-language-selector">
                <label htmlFor="quick-replies-lang">Мова:</label>
                <select
                  id="quick-replies-lang"
                  className="quick-replies-lang-select"
                  value={selectedLocale}
                  onChange={(e) => setSelectedLocale(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                >
                  {availableLocales.map((lang) => (
                    <option key={lang} value={lang}>
                      {languageNames[lang] || lang.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="quick-replies-list">
            {activeReplies.map((reply) => {
              const text = reply.translations?.[selectedLocale] || reply.text;
              return (
                <button
                  key={reply.id}
                  className="quick-reply-item"
                  onClick={() => handleSelect(reply)}
                  title={text}
                >
                  <span className="quick-reply-text">{text}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickReplies;

