import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../api/client';
import { useChatStore } from '../../../store/chatStore';
import '../../../styles/Modal.css';

interface StatusModalProps {
  chatId: number;
  currentStatus: 'new' | 'in_progress' | 'closed' | 'snoozed';
  onClose: () => void;
}

const StatusModal: React.FC<StatusModalProps> = ({ chatId, currentStatus, onClose }) => {
  const { updateChat } = useChatStore();
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState<'in_progress' | 'closed' | 'snoozed'>(currentStatus === 'new' ? 'in_progress' : currentStatus);

  const statusOptions: Array<{ value: 'in_progress' | 'closed' | 'snoozed'; label: string; icon: string }> = [
    { value: 'in_progress', label: 'В работе', icon: '🔄' },
    { value: 'closed', label: 'Закрыт', icon: '✅' },
    { value: 'snoozed', label: 'Отложен', icon: '⏸️' },
  ];

  const closeChatMutation = useMutation({
    mutationFn: () => apiClient.closeChat(chatId),
    onSuccess: (data) => {
      console.log('✅ Chat closed successfully:', data);
      updateChat(chatId, { status: 'closed' });
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      queryClient.invalidateQueries({ queryKey: ['chat', chatId] });
      onClose();
    },
    onError: (error: any) => {
      console.error('❌ Error closing chat:', error);
      alert(`Ошибка: ${error.response?.data?.message || error.message || 'Не удалось закрыть чат'}`);
    },
  });

  const reopenChatMutation = useMutation({
    mutationFn: () => apiClient.reopenChat(chatId),
    onSuccess: (data) => {
      console.log('✅ Chat reopened successfully:', data);
      updateChat(chatId, { status: 'in_progress' });
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      queryClient.invalidateQueries({ queryKey: ['chat', chatId] });
      onClose();
    },
    onError: (error: any) => {
      console.error('❌ Error reopening chat:', error);
      alert(`Ошибка: ${error.response?.data?.message || error.message || 'Не удалось открыть чат'}`);
    },
  });

  const deferChatMutation = useMutation({
    mutationFn: () => apiClient.deferChat(chatId),
    onSuccess: (data) => {
      console.log('✅ Chat deferred successfully:', data);
      updateChat(chatId, { status: 'snoozed' });
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      queryClient.invalidateQueries({ queryKey: ['chat', chatId] });
      onClose();
    },
    onError: (error: any) => {
      console.error('❌ Error deferring chat:', error);
      alert(`Ошибка: ${error.response?.data?.message || error.message || 'Не удалось отложить чат'}`);
    },
  });

  const undeferChatMutation = useMutation({
    mutationFn: () => apiClient.undeferChat(chatId),
    onSuccess: (data) => {
      console.log('✅ Chat undeferred successfully:', data);
      updateChat(chatId, { status: 'in_progress' });
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      queryClient.invalidateQueries({ queryKey: ['chat', chatId] });
      onClose();
    },
    onError: (error: any) => {
      console.error('❌ Error undeferring chat:', error);
      alert(`Ошибка: ${error.response?.data?.message || error.message || 'Не удалось возобновить чат'}`);
    },
  });

  const handleStatusChange = () => {
    if (selectedStatus === 'closed') {
      if (currentStatus === 'closed') {
        reopenChatMutation.mutate();
      } else {
        closeChatMutation.mutate();
      }
    } else if (selectedStatus === 'snoozed') {
      if (currentStatus === 'snoozed') {
        undeferChatMutation.mutate();
      } else {
        deferChatMutation.mutate();
      }
    } else if (selectedStatus === 'in_progress') {
      if (currentStatus === 'closed') {
        reopenChatMutation.mutate();
      } else if (currentStatus === 'snoozed') {
        undeferChatMutation.mutate();
      }
    }
  };

  const isPending = closeChatMutation.isPending || reopenChatMutation.isPending || deferChatMutation.isPending || undeferChatMutation.isPending;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Изменить статус</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="status-options">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                className={`status-option ${selectedStatus === option.value ? 'active' : ''} ${currentStatus === option.value ? 'current' : ''}`}
                onClick={() => setSelectedStatus(option.value)}
              >
                <span className="status-icon">{option.icon}</span>
                <span className="status-label">{option.label}</span>
                {currentStatus === option.value && <span className="status-badge">Текущий</span>}
              </button>
            ))}
          </div>
          <div className="modal-actions">
            <button
              className="modal-btn primary"
              onClick={handleStatusChange}
              disabled={isPending || selectedStatus === currentStatus}
            >
              {isPending ? 'Обработка...' : 'Применить'}
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

export default StatusModal;

