import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import '../styles/Modal.css';

interface Manager {
  id: number;
  name: string;
  email: string;
  avatar?: string;
  is_online?: boolean;
  last_seen_at?: string;
}

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
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loadingManagers, setLoadingManagers] = useState(false);

  // Загружаем список менеджеров
  useEffect(() => {
    if (action === 'assign') {
      loadManagers();
    }
  }, [action]);

  const loadManagers = async () => {
    setLoadingManagers(true);
    try {
      const managersList = await apiClient.getAvailableManagers();
      
      // Загружаем дополнительную информацию (аватары) для каждого менеджера
      const managersWithAvatars = await Promise.all(
        managersList.map(async (manager: Manager) => {
          try {
            const userData = await apiClient.getUser(manager.id);
            return {
              ...manager,
              avatar: userData.avatar,
              is_online: userData.is_online,
              last_seen_at: userData.last_seen_at,
            };
          } catch (error) {
            console.warn(`Failed to load user data for manager ${manager.id}:`, error);
            return manager;
          }
        })
      );
      
      setManagers(managersWithAvatars);
    } catch (error) {
      console.error('Failed to load managers:', error);
      setManagers([]);
    } finally {
      setLoadingManagers(false);
    }
  };

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
              
              {loadingManagers ? (
                <div className="managers-loading">Загрузка менеджеров...</div>
              ) : (
                <div className="managers-list">
                  {/* Кнопка "Назначить себе" */}
                  {user && (
                    <button
                      className={`manager-item ${currentManagerId === user.id ? 'current' : ''}`}
                      onClick={handleAssignToMe}
                      disabled={assignChatMutation.isPending}
                    >
                      <div className="manager-avatar">
                        {user.avatar ? (
                          <img src={user.avatar} alt={user.name || 'Вы'} />
                        ) : (
                          <span>{(user.name || 'Вы').charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="manager-info">
                        <span className="manager-name">{user.name || 'Вы'}</span>
                        <span className="manager-email">{user.email}</span>
                      </div>
                      {currentManagerId === user.id && (
                        <span className="current-badge">Текущий</span>
                      )}
                    </button>
                  )}

                  {/* Список других менеджеров */}
                  {managers
                    .filter((m) => m.id !== user?.id)
                    .map((manager) => (
                      <button
                        key={manager.id}
                        className={`manager-item ${currentManagerId === manager.id ? 'current' : ''}`}
                        onClick={() => assignChatMutation.mutate(manager.id)}
                        disabled={assignChatMutation.isPending}
                      >
                        <div className="manager-avatar">
                          {manager.avatar ? (
                            <img 
                              src={manager.avatar} 
                              alt={manager.name}
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent) {
                                  parent.textContent = manager.name.charAt(0).toUpperCase();
                                }
                              }}
                            />
                          ) : (
                            <span>{manager.name.charAt(0).toUpperCase()}</span>
                          )}
                          {manager.is_online && <span className="online-indicator"></span>}
                        </div>
                        <div className="manager-info">
                          <span className="manager-name">{manager.name}</span>
                          <span className="manager-email">{manager.email}</span>
                        </div>
                        {currentManagerId === manager.id && (
                          <span className="current-badge">Текущий</span>
                        )}
                      </button>
                    ))}
                </div>
              )}

              <div className="modal-actions">
                <button className="modal-btn secondary" onClick={onClose}>
                  Отмена
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssignModal;

