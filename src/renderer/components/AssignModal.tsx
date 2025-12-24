import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import '../styles/Modal.css';

interface AssignModalProps {
  chatId: number;
  currentManagerId?: number;
  onClose: () => void;
}

const AssignModal: React.FC<AssignModalProps> = ({ chatId, currentManagerId, onClose }) => {
  const { user } = useAuthStore();
  const { updateChat } = useChatStore();
  const queryClient = useQueryClient();
  const [action, setAction] = useState<'take' | 'assign'>('take');

  const takeChatMutation = useMutation({
    mutationFn: () => apiClient.takeChat(chatId),
    onSuccess: (data) => {
      console.log('✅ Chat taken successfully:', data);
      updateChat(chatId, { assigned_manager_id: user?.id, status: 'in_progress' });
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      queryClient.invalidateQueries({ queryKey: ['chat', chatId] });
      onClose();
    },
    onError: (error: any) => {
      console.error('❌ Error taking chat:', error);
      alert(`Ошибка: ${error.response?.data?.message || error.message || 'Не удалось взять чат'}`);
    },
  });

  const assignChatMutation = useMutation({
    mutationFn: (managerId: number) => apiClient.assignChat(chatId, managerId),
    onSuccess: (data) => {
      console.log('✅ Chat assigned successfully:', data);
      updateChat(chatId, { assigned_manager_id: data.assigned_manager_id });
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      queryClient.invalidateQueries({ queryKey: ['chat', chatId] });
      onClose();
    },
    onError: (error: any) => {
      console.error('❌ Error assigning chat:', error);
      alert(`Ошибка: ${error.response?.data?.message || error.message || 'Не удалось назначить чат'}`);
    },
  });

  const handleTakeChat = () => {
    if (!user?.id) {
      alert('Ошибка: пользователь не найден');
      return;
    }
    takeChatMutation.mutate();
  };

  const handleAssignToMe = () => {
    if (!user?.id) {
      alert('Ошибка: пользователь не найден');
      return;
    }
    assignChatMutation.mutate(user.id);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Назначить чат</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="assign-actions">
            <button
              className={`assign-action-btn ${action === 'take' ? 'active' : ''}`}
              onClick={() => setAction('take')}
            >
              Взять себе
            </button>
            <button
              className={`assign-action-btn ${action === 'assign' ? 'active' : ''}`}
              onClick={() => setAction('assign')}
            >
              Назначить другому
            </button>
          </div>

          {action === 'take' && (
            <div className="assign-content">
              <p>Вы хотите взять этот чат себе?</p>
              <div className="modal-actions">
                <button
                  className="modal-btn primary"
                  onClick={handleTakeChat}
                  disabled={takeChatMutation.isPending}
                >
                  {takeChatMutation.isPending ? 'Обработка...' : 'Взять чат'}
                </button>
                <button className="modal-btn secondary" onClick={onClose}>
                  Отмена
                </button>
              </div>
            </div>
          )}

          {action === 'assign' && (
            <div className="assign-content">
              <p>Назначить чат себе или другому менеджеру:</p>
              <div className="modal-actions">
                <button
                  className="modal-btn primary"
                  onClick={handleAssignToMe}
                  disabled={assignChatMutation.isPending}
                >
                  {assignChatMutation.isPending ? 'Обработка...' : 'Назначить себе'}
                </button>
                <button className="modal-btn secondary" onClick={onClose}>
                  Отмена
                </button>
              </div>
              <p className="modal-note">
                Примечание: Функция назначения другому менеджеру будет добавлена позже
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssignModal;

