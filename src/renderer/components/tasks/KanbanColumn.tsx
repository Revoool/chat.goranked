import React, { useState, useRef, useEffect } from 'react';
import { Board, Task } from '../../types';
import KanbanCard from './KanbanCard';
import { IconGripVertical, IconDots, IconX, IconPencil, IconTrash } from '../../icons';
import '../../styles/KanbanColumn.css';

interface KanbanColumnProps {
  board: Board;
  tasks: Task[];
  loading: boolean;
  onTaskClick: (task: Task) => void;
  onTaskMove: (task: Task, toBoardId: number, newIndex: number) => void;
  onTaskCreate: (boardId: number, taskData: Partial<Task>) => void;
  onTaskDelete: (task: Task) => void;
  onColumnDragStart: (boardId: number) => void;
  onColumnDrop: (draggedId: number, targetId: number) => void;
  isDragged?: boolean;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({
  board,
  tasks,
  loading,
  onTaskClick,
  onTaskMove,
  onTaskCreate,
  onTaskDelete,
  onColumnDragStart,
  onColumnDrop,
  isDragged = false,
}) => {
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [boardName, setBoardName] = useState(board.name);
  const [showMenu, setShowMenu] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setBoardName(board.name);
  }, [board.name]);

  // Close menu on outside click
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

  const handleAddCard = () => {
    if (!newTaskName.trim()) {
      setIsAddingCard(false);
      return;
    }

    onTaskCreate(board.id, {
      name: newTaskName.trim(),
      status_id: undefined,
    });

    setNewTaskName('');
    setIsAddingCard(false);
  };

  const handleTaskDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTaskId(task.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ taskId: task.id, boardId: board.id }));
  };

  const handleTaskDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleTaskDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(null);

    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      const { taskId, boardId } = data;

      if (boardId === board.id) {
        // Moving within same column - reorder
        const task = tasks.find((t) => t.id === taskId);
        if (task) {
          const currentIndex = tasks.findIndex((t) => t.id === taskId);
          if (currentIndex !== index) {
            onTaskMove(task, board.id, index);
          }
        }
      } else {
        // Moving from another column
        const task = tasks.find((t) => t.id === taskId);
        if (task) {
          onTaskMove(task, board.id, index);
        }
      }
    } catch (error) {
      console.error('Error handling drop:', error);
    }

    setDraggedTaskId(null);
  };

  const handleColumnDragStart = (e: React.DragEvent) => {
    onColumnDragStart(board.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(board.id));
  };

  const handleColumnDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleColumnDrop = (e: React.DragEvent) => {
    e.preventDefault();
    try {
      const draggedId = parseInt(e.dataTransfer.getData('text/plain'));
      if (!isNaN(draggedId) && draggedId !== board.id) {
        onColumnDrop(draggedId, board.id);
      }
    } catch (error) {
      console.error('Error handling column drop:', error);
    }
  };

  const handleRename = () => {
    if (boardName.trim() && boardName !== board.name) {
      // API call would be here - for now just update local state
      setIsRenaming(false);
      setShowMenu(false);
    } else {
      setBoardName(board.name);
      setIsRenaming(false);
    }
  };

  const handleDelete = () => {
    if (confirm(`Ви впевнені, що хочете видалити колонку "${board.name}"?`)) {
      // API call would be here
      setShowMenu(false);
    }
  };

  return (
    <div
      ref={columnRef}
      className={`kanban-column ${isDragged ? 'kanban-column-dragged' : ''}`}
      draggable
      onDragStart={handleColumnDragStart}
      onDragOver={handleColumnDragOver}
      onDrop={handleColumnDrop}
    >
      {/* Header */}
      <div className="kanban-column-header">
        <div className="kanban-column-title-wrapper">
          <div className="kanban-column-handle" title="Перемістити колонку">
            <IconGripVertical size={18} />
          </div>
          {isRenaming ? (
            <input
              type="text"
              className="kanban-column-title-input"
              value={boardName}
              onChange={(e) => setBoardName(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleRename();
                } else if (e.key === 'Escape') {
                  setBoardName(board.name);
                  setIsRenaming(false);
                }
              }}
              autoFocus
            />
          ) : (
            <div>
              <div className="kanban-column-title">{board.name}</div>
              <span className="kanban-column-counter">{tasks.length} карток</span>
            </div>
          )}
        </div>

        <div className="kanban-column-menu" ref={menuRef}>
          <button
            className="kanban-column-menu-btn"
            onClick={() => setShowMenu(!showMenu)}
            title="Меню колонки"
          >
            <IconDots size={18} />
          </button>
          {showMenu && (
            <div className="kanban-column-menu-dropdown">
              <button
                className="kanban-column-menu-item"
                onClick={() => {
                  setIsRenaming(true);
                  setShowMenu(false);
                }}
              >
                <IconPencil size={16} />
                Перейменувати
              </button>
              <button className="kanban-column-menu-item kanban-column-menu-item-danger" onClick={handleDelete}>
                <IconTrash size={16} />
                Видалити колонку
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="kanban-column-body">
        {tasks.map((task, index) => (
          <div
            key={task.id}
            className={`kanban-card-wrapper ${draggedTaskId === task.id ? 'kanban-card-dragging' : ''} ${
              dragOverIndex === index ? 'kanban-card-drag-over' : ''
            }`}
            draggable
            onDragStart={(e) => handleTaskDragStart(e, task)}
            onDragOver={(e) => handleTaskDragOver(e, index)}
            onDrop={(e) => handleTaskDrop(e, index)}
            onDragEnd={() => {
              setDraggedTaskId(null);
              setDragOverIndex(null);
            }}
          >
            <KanbanCard task={task} onClick={() => onTaskClick(task)} onDelete={() => onTaskDelete(task)} />
          </div>
        ))}

        {!loading && tasks.length === 0 && (
          <div className="kanban-column-empty">Поки що порожньо</div>
        )}
      </div>

      {/* Footer */}
      <div className="kanban-column-footer">
        {isAddingCard ? (
          <div className="kanban-add-card-form">
            <input
              type="text"
              className="kanban-add-card-input"
              placeholder="Назва задачі..."
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAddCard();
                } else if (e.key === 'Escape') {
                  setIsAddingCard(false);
                  setNewTaskName('');
                }
              }}
              autoFocus
            />
            <div className="kanban-add-card-actions">
              <button className="kanban-add-card-btn kanban-add-card-btn-primary" onClick={handleAddCard}>
                Додати
              </button>
              <button
                className="kanban-add-card-btn"
                onClick={() => {
                  setIsAddingCard(false);
                  setNewTaskName('');
                }}
              >
                <IconX size={16} />
              </button>
            </div>
          </div>
        ) : (
          <button className="kanban-add-card-trigger" onClick={() => setIsAddingCard(true)}>
            + Додати картку
          </button>
        )}
      </div>

      {loading && <div className="kanban-column-loading">Завантаження...</div>}
    </div>
  );
};

export default KanbanColumn;

