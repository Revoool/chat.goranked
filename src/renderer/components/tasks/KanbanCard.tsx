import React, { useState, useRef, useEffect } from 'react';
import { Task } from '../../types';
import { IconGripVertical, IconDots, IconMessage } from '../../icons';
import '../../styles/KanbanCard.css';

interface KanbanCardProps {
  task: Task;
  onClick: () => void;
  onDelete: () => void;
}

const KanbanCard: React.FC<KanbanCardProps> = ({ task, onClick, onDelete }) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  const statusColor = task.status?.color || '#6366f1';
  const hasStatus = Boolean(task.status);
  const deadline = task.finish_at ? new Date(task.finish_at) : null;
  const deadlineLabel = deadline
    ? deadline.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : 'Без дедлайну';

  const assignee = task.assignees && task.assignees.length > 0 ? task.assignees[0] : null;
  const assigneeInitials = assignee?.name ? assignee.name.charAt(0).toUpperCase() : 'U';

  const getContrastColor = (hex: string): string => {
    const r = parseInt(hex.substring(1, 3), 16);
    const g = parseInt(hex.substring(3, 5), 16);
    const b = parseInt(hex.substring(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? '#1f2937' : '#f8fafc';
  };

  const statusStyle = hasStatus
    ? {
        backgroundColor: statusColor,
        color: getContrastColor(statusColor),
      }
    : undefined;

  return (
    <div className="kanban-card" onClick={onClick}>
      <div className="kanban-card-inner">
        <div className="kanban-card-drag" onClick={(e) => e.stopPropagation()}>
          <IconGripVertical size={16} />
        </div>

        <div className="kanban-card-content">
          <div className="kanban-card-title">{task.name || 'Без назви'}</div>

          {task.content && (
            <div className="kanban-card-description">{task.content}</div>
          )}

          <div className="kanban-card-meta">
            <span
              className={`kanban-card-chip ${!hasStatus ? 'kanban-card-chip-muted' : ''}`}
              style={statusStyle}
            >
              {hasStatus ? task.status!.name : 'Без статусу'}
            </span>
            <span className="kanban-card-chip kanban-card-chip-muted">{deadlineLabel}</span>
          </div>
        </div>

        <div className="kanban-card-aside">
          <div className="kanban-card-icons">
            {task.comments_count && task.comments_count > 0 ? (
              <div className="kanban-card-counter" title="Коментарі">
                <IconMessage size={16} />
                <span>{task.comments_count}</span>
              </div>
            ) : (
              <div className="kanban-card-counter kanban-card-counter-muted">
                <IconMessage size={16} />
              </div>
            )}
          </div>

          {assignee && (
            <div className="kanban-card-avatar" title={assignee.name}>
              {assigneeInitials}
            </div>
          )}
        </div>

        <div className="kanban-card-menu" ref={menuRef}>
          <button
            className="kanban-card-menu-btn"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
          >
            <IconDots size={16} />
          </button>
          {showMenu && (
            <div className="kanban-card-menu-dropdown">
              <button
                className="kanban-card-menu-item"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  onClick();
                }}
              >
                Відкрити
              </button>
              <button
                className="kanban-card-menu-item kanban-card-menu-item-danger"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  if (confirm('Ви впевнені, що хочете видалити цю задачу?')) {
                    onDelete();
                  }
                }}
              >
                Видалити
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KanbanCard;

