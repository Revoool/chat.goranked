import React, { useState, useRef, useEffect } from 'react';
import { Task, TasksSubdata } from '../../types';
import { apiClient } from '../../api/client';
import { 
  IconCircleCheckFilled, 
  IconCircleDotted, 
  IconFlagFilled, 
  IconFlag,
  IconRotateClockwise,
  IconCheck,
  IconChevronDown
} from '../../icons';
import '../../styles/TaskRow.css';
import '../../styles/TaskFilters.css';

interface TaskRowProps {
  task: Task;
  subdata: TasksSubdata;
  onClick: () => void;
  onStatusUpdated?: (data: { taskId: number; statusId: number | null; updatedTask?: Task }) => void;
}

const TaskRow: React.FC<TaskRowProps> = ({ task, subdata, onClick, onStatusUpdated }) => {
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingPriority, setUpdatingPriority] = useState(false);
  const [completingRecurring, setCompletingRecurring] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  const status = subdata.statuses?.find(s => s.id === task.status_id) || null;
  const category = task.category || null;

  // Первый исполнитель для обратной совместимости
  const assignee = task.assignees && task.assignees.length > 0 
    ? task.assignees[0] 
    : subdata.users?.find(u => u.id === task.user_id) || null;

  // Все исполнители
  const assignees = task.assignees && Array.isArray(task.assignees) && task.assignees.length > 0
    ? task.assignees
    : task.user_id
      ? (subdata.users?.find(u => u.id === task.user_id) ? [subdata.users.find(u => u.id === task.user_id)!] : [])
      : [];

  const isClosed = status?.name === 'CLOSED' || status?.name === 'Виконано' || status?.name === 'Done';

  const formatDate = (dateString?: string): string | null => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const taskDate = new Date(date);
    taskDate.setHours(0, 0, 0, 0);
    
    const diffTime = taskDate.getTime() - today.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays > 1 && diffDays < 7) {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return days[taskDate.getDay()];
    }
    return date.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  const isOverdue = (): boolean => {
    if (!task.finish_at || isClosed) return false;
    const date = new Date(task.finish_at);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const taskDate = new Date(date);
    taskDate.setHours(0, 0, 0, 0);
    return taskDate.getTime() < today.getTime();
  };

  const getInitials = (name?: string): string => {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getAssigneeColor = (userId?: number): string => {
    const colors = ['var(--flame-orange)', 'var(--champion-gold)', 'var(--success)', '#ff9800', '#f44336', '#2196f3'];
    return colors[(userId || 0) % colors.length] || 'var(--flame-orange)';
  };

  const toggleTaskComplete = async (checked: boolean) => {
    if (!task.board_id) return;
    
    try {
      const closedStatus = subdata.statuses?.find(s => 
        ['CLOSED', 'Виконано', 'Done', 'Завершено'].includes(s.name)
      );
      
      if (checked && closedStatus) {
        await apiClient.updateTask(task.board_id, task.id, {
          status_id: closedStatus.id,
        });
      } else if (!checked) {
        const openStatus = subdata.statuses?.find(s => 
          ['OPEN', 'Відкрито', 'Open', 'Новий', 'New'].includes(s.name)
        );
        if (openStatus) {
          await apiClient.updateTask(task.board_id, task.id, {
            status_id: openStatus.id,
          });
        }
      }
      
      onStatusUpdated?.({
        taskId: task.id,
        statusId: checked ? closedStatus?.id || null : null,
      });
    } catch (error) {
      console.error('Error toggling task complete:', error);
    }
  };

  const updateStatus = async (newStatusId: number | null) => {
    if (updatingStatus || !task.board_id) return;
    
    setUpdatingStatus(true);
    setStatusMenuOpen(false);
    
    try {
      const response = await apiClient.updateTask(task.board_id, task.id, {
        status_id: newStatusId || undefined,
      });
      
      onStatusUpdated?.({
        taskId: task.id,
        statusId: newStatusId,
        updatedTask: response?.task || response,
      });
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Помилка оновлення статусу');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const togglePriority = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (updatingPriority || !task.board_id) return;
    
    setUpdatingPriority(true);
    const newPriorityValue = !task.is_priority;
    
    try {
      const response = await apiClient.updateTask(task.board_id, task.id, {
        is_priority: newPriorityValue,
      });
      
      onStatusUpdated?.({
        taskId: task.id,
        statusId: task.status_id || null,
        updatedTask: response?.task || { ...task, is_priority: newPriorityValue },
      });
    } catch (error) {
      console.error('Error updating priority:', error);
      alert('Помилка оновлення пріоритету');
    } finally {
      setUpdatingPriority(false);
    }
  };

  const handleRowClick = (e: React.MouseEvent) => {
    // Не открываем модалку, если клик был на статусе, приоритете или чекбоксе
    const target = e.target as HTMLElement;
    if (target.closest('.status-select-wrapper') || 
        target.closest('.task-col-priority') ||
        target.closest('.task-col-checkbox')) {
      return;
    }
    onClick();
  };

  // Закрытие меню статуса при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(event.target as Node)) {
        setStatusMenuOpen(false);
      }
    };

    if (statusMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [statusMenuOpen]);

  return (
    <div 
      className={`task-row ${isClosed ? 'task-row-closed' : ''}`}
      onClick={handleRowClick}
    >
      {/* Task Checkbox */}
      <div className="task-col-checkbox" onClick={(e) => e.stopPropagation()}>
        <label className="custom-checkbox">
          <input
            type="checkbox"
            checked={isClosed}
            onChange={(e) => toggleTaskComplete(e.target.checked)}
            className="task-checkbox-input"
          />
          <span className="custom-checkbox-mark">
            {isClosed && (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </span>
        </label>
      </div>

      {/* Name */}
      <div className="task-col-name">
        <div className="task-name-content">
          <span className="task-name-text">{task.name || 'Без назви'}</span>
          {category && (
            <span 
              className="category-chip"
              style={category.color ? {
                backgroundColor: category.color + '20',
                color: category.color,
              } : {}}
            >
              {category.name}
            </span>
          )}
        </div>
      </div>

      {/* Assignees */}
      <div className="task-col-assignee" onClick={(e) => e.stopPropagation()}>
        {assignees.length > 0 ? (
          <div className="assignees-overlap">
            {assignees.slice(0, 2).map((assigneeItem, idx) => (
              <div
                key={assigneeItem.id || idx}
                className={`assignee-avatar ${idx > 0 ? 'assignee-avatar-overlap' : ''}`}
                title={`${assigneeItem.name} (ID: ${assigneeItem.id})`}
                style={{
                  backgroundColor: assigneeItem.avatar ? 'transparent' : getAssigneeColor(assigneeItem.id),
                }}
              >
                {assigneeItem.avatar ? (
                  <img src={assigneeItem.avatar} alt={assigneeItem.name} />
                ) : (
                  <span className="assignee-initials">{getInitials(assigneeItem.name)}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <span className="text-muted">—</span>
        )}
      </div>

      {/* Order */}
      <div className="task-col-order" onClick={(e) => e.stopPropagation()}>
        {task.order_id && task.order_type ? (
          <button
            className="order-chip"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              const baseUrl = 'https://goranked.gg';
              const url = task.order_type === 'boost' 
                ? `${baseUrl}/orders/edit/${task.order_id}`
                : `${baseUrl}/accounts/orders/edit/${task.order_id}`;
              if (window.electronAPI?.openExternal) {
                window.electronAPI.openExternal(url);
              } else {
                window.open(url, '_blank');
              }
            }}
          >
            {task.order_type === 'boost' ? 'Буст' : 'Маркет'} #{task.order_id}
          </button>
        ) : (
          <span className="text-muted">—</span>
        )}
      </div>

      {/* Due Date */}
      <div className="task-col-due">
        {task.finish_at ? (
          <div className="task-date-content">
            {!isOverdue() && !isClosed && (
              <IconRotateClockwise size={14} className="text-muted" />
            )}
            <span className={`task-date-text ${isOverdue() && !isClosed ? 'text-error' : ''}`}>
              {formatDate(task.finish_at)}
            </span>
          </div>
        ) : (
          <span className="text-muted">—</span>
        )}
      </div>

      {/* Priority */}
      <div className="task-col-priority" onClick={togglePriority}>
        <button 
          className={`priority-btn ${task.is_priority ? 'priority-btn-active' : ''}`}
          disabled={updatingPriority}
          title={task.is_priority ? 'Прибрати пріоритет' : 'Встановити пріоритет'}
        >
          {task.is_priority ? (
            <IconFlagFilled size={18} className="text-error" />
          ) : (
            <IconFlag size={18} className="text-muted" />
          )}
        </button>
      </div>

      {/* Status */}
      <div className="task-col-status status-select-wrapper" onClick={(e) => e.stopPropagation()} ref={statusMenuRef}>
        <div 
          className="status-display"
          onClick={() => setStatusMenuOpen(!statusMenuOpen)}
        >
          {isClosed ? (
            <IconCircleCheckFilled size={18} className="text-success" />
          ) : (
            <IconCircleDotted size={18} className="text-muted" />
          )}
          <span className={`status-text ${updatingStatus ? 'status-text-updating' : ''}`}>
            {updatingStatus ? '...' : (status?.name || 'OPEN')}
          </span>
          <IconChevronDown size={14} className="text-muted" />
        </div>

        {statusMenuOpen && (
          <div className="status-menu">
            {subdata.statuses?.map((statusItem) => (
              <div
                key={statusItem.id}
                className={`status-menu-item ${statusItem.id === task.status_id ? 'status-item-selected' : ''}`}
                onClick={() => updateStatus(statusItem.id)}
              >
                <div
                  className="status-menu-color"
                  style={{ backgroundColor: statusItem.color || '#6366f1' }}
                />
                <span>{statusItem.name}</span>
                {statusItem.id === task.status_id && (
                  <IconCheck size={16} className="text-success" />
                )}
              </div>
            ))}
            {task.status_id && (
              <div
                className="status-menu-item"
                onClick={() => updateStatus(null)}
              >
                <div className="status-menu-color status-menu-color-empty" />
                <span className="text-muted">Без статусу</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Start Date */}
      <div className="task-col-start">
        {task.start_at ? (
          <span className="task-date-text">{formatDate(task.start_at)}</span>
        ) : task.created_at ? (
          <span className="task-date-text">{formatDate(task.created_at)}</span>
        ) : (
          <span className="text-muted">—</span>
        )}
      </div>
    </div>
  );
};

export default TaskRow;

