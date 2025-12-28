import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { IconX, IconCheck } from '../../icons';
import '../../styles/AiSuggestions.css';

interface AiSuggestionsProps {
  chatId: number;
  onSelect: (suggestion: string, suggestionIndex: number, aiRunId?: number) => void;
  onClose?: () => void;
}

const AiSuggestions: React.FC<AiSuggestionsProps> = ({ chatId, onSelect, onClose }) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [forceRefresh, setForceRefresh] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['ai-suggestions', chatId, forceRefresh],
    queryFn: () => apiClient.getAiSuggestions(chatId, { force_refresh: forceRefresh }),
    enabled: !!chatId,
    staleTime: 0, // Не кешируем на фронтенде, чтобы всегда запрашивать свежие данные
    retry: 1,
  });

  const handleSelect = (suggestion: string, index: number) => {
    setSelectedIndex(index);
    const aiRunId = data?.data?.ai_run_id;
    onSelect(suggestion, index, aiRunId);
  };

  if (isLoading) {
    return (
      <div className="ai-suggestions">
      <div className="ai-suggestions-header">
        <span className="ai-icon">✨</span>
        <span>Генерую предложения...</span>
      </div>
        <div className="ai-suggestions-loading">
          <div className="ai-suggestions-spinner"></div>
        </div>
      </div>
    );
  }

  if (error || !data?.success || !data?.data?.suggestions?.length) {
    return (
      <div className="ai-suggestions">
        <div className="ai-suggestions-header">
          <span className="ai-icon">✨</span>
          <span>AI-помощник</span>
          {onClose && (
            <button className="ai-suggestions-close" onClick={onClose}>
              <IconX size={14} />
            </button>
          )}
        </div>
        <div className="ai-suggestions-error">
          {error ? (
            <span>Ошибка загрузки предложений</span>
          ) : (
            <span>Предложения не найдены</span>
          )}
          <button className="ai-suggestions-retry" onClick={() => refetch()}>
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  const suggestions = data.data.suggestions;

  return (
    <div className="ai-suggestions">
      <div className="ai-suggestions-header">
        <span className="ai-icon">✨</span>
        <span>AI-предложения ответов</span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
            className="ai-suggestions-refresh" 
            onClick={() => {
              setForceRefresh(prev => !prev);
              setTimeout(() => refetch(), 50);
            }}
            title="Обновить предложения (игнорировать кеш)"
            style={{ 
              background: 'transparent', 
              border: 'none', 
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              color: '#a0a0a0'
            }}
          >
            🔄
          </button>
          {onClose && (
            <button className="ai-suggestions-close" onClick={onClose}>
              <IconX size={14} />
            </button>
          )}
        </div>
      </div>
      <div className="ai-suggestions-list">
        {suggestions.map((suggestion: string, index: number) => (
          <button
            key={index}
            className={`ai-suggestion-item ${selectedIndex === index ? 'selected' : ''}`}
            onClick={() => handleSelect(suggestion, index)}
            title="Нажмите, чтобы использовать это предложение"
          >
            <span className="ai-suggestion-number">{index + 1}</span>
            <span className="ai-suggestion-text">{suggestion}</span>
            {selectedIndex === index && (
              <IconCheck size={14} className="ai-suggestion-check" />
            )}
          </button>
        ))}
      </div>
      {data.data.context_used && (
        <div className="ai-suggestions-footer">
          <span className="ai-suggestions-info">
            Использовано {data.data.context_used} сообщений из истории
            {data.data.similar_situations_found > 0 && 
              ` • Найдено ${data.data.similar_situations_found} похожих ситуаций`}
          </span>
        </div>
      )}
    </div>
  );
};

export default AiSuggestions;

