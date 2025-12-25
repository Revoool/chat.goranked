import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useChatStore } from '../store/chatStore';
import { IconArrowDown, IconArrowRight, IconArrowUp, IconAlertCircle } from '../icons';
import '../styles/Modal.css';

interface PriorityModalProps {
  chatId: number;
  currentPriority: 'low' | 'normal' | 'high' | 'urgent';
  onClose: () => void;
}

const PriorityModal: React.FC<PriorityModalProps> = ({ chatId, currentPriority, onClose }) => {
  const { updateChat } = useChatStore();
  const queryClient = useQueryClient();
  const [selectedPriority, setSelectedPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>(currentPriority);

  const priorityOptions: Array<{
    value: 'low' | 'normal' | 'high' | 'urgent';
    label: string;
    icon: React.ReactNode;
    color: string;
  }> = [
    { value: 'low', label: 'Низкий', icon: <IconArrowDown size={20} />, color: '#4a90e2' },
    { value: 'normal', label: 'Обычный', icon: <IconArrowRight size={20} />, color: '#7b7b7b' },
    { value: 'high', label: 'Высокий', icon: <IconArrowUp size={20} />, color: '#f5a623' },
    { value: 'urgent', label: 'Срочный', icon: <IconAlertCircle size={20} />, color: '#d0021b' },
  ];

  const updatePriorityMutation = useMutation({
    mutationFn: (priority: 'low' | 'normal' | 'high' | 'urgent') =>
      apiClient.updateChatPriority(chatId, priority),
    onSuccess: (data, priority) => {
      console.log('✅ Priority updated successfully:', priority);
      updateChat(chatId, { priority });
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      queryClient.invalidateQueries({ queryKey: ['chat', chatId] });
      onClose();
    },
    onError: (error: any) => {
      console.error('❌ Error updating priority:', error);
      alert(`Ошибка: ${error.response?.data?.message || error.message || 'Не удалось изменить приоритет'}`);
    },
  });

  const handleSave = () => {
    if (selectedPriority !== currentPriority) {
      updatePriorityMutation.mutate(selectedPriority);
    } else {
      onClose();
    }
  };

  const isPending = updatePriorityMutation.isPending;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Изменить приоритет</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="priority-options">
            {priorityOptions.map((option) => (
              <button
                key={option.value}
                className={`priority-option ${selectedPriority === option.value ? 'active' : ''} ${currentPriority === option.value ? 'current' : ''}`}
                onClick={() => setSelectedPriority(option.value)}
                style={{
                  borderColor: selectedPriority === option.value ? option.color : 'transparent',
                  backgroundColor: selectedPriority === option.value ? `${option.color}15` : 'transparent',
                }}
              >
                <span className="priority-icon" style={{ color: option.color }}>
                  {option.icon}
                </span>
                <span className="priority-label">{option.label}</span>
                {currentPriority === option.value && (
                  <span className="priority-badge">Текущий</span>
                )}
              </button>
            ))}
          </div>
          <div className="modal-actions">
            <button
              className="modal-btn primary"
              onClick={handleSave}
              disabled={isPending || selectedPriority === currentPriority}
            >
              {isPending ? 'Сохранение...' : 'Применить'}
            </button>
            <button className="modal-btn secondary" onClick={onClose}>
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PriorityModal;

