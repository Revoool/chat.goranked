import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { Board, Task, TasksSubdata } from '../../types';
import KanbanColumn from './KanbanColumn';
import TaskDialog from './TaskDialog';
import { IconRefresh, IconPlus } from '../../icons';
import '../../styles/KanbanBoard.css';

interface KanbanBoardProps {
  onTaskClick?: (task: Task) => void;
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({ onTaskClick }) => {
  const [boards, setBoards] = useState<Board[]>([]);
  const [tasksByBoard, setTasksByBoard] = useState<Record<number, Task[]>>({});
  const [loading, setLoading] = useState(false);
  const [loadingBoards, setLoadingBoards] = useState<Set<number>>(new Set());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [draggedColumn, setDraggedColumn] = useState<number | null>(null);
  const [draggedTask, setDraggedTask] = useState<{ task: Task; boardId: number } | null>(null);
  const queryClient = useQueryClient();

  // Load subdata
  const { data: subdata } = useQuery<TasksSubdata>({
    queryKey: ['tasks-subdata'],
    queryFn: async () => {
      const subdataResponse = await apiClient.getBoardsSubdata();
      const boardsList = await apiClient.getBoards();
      return {
        ...subdataResponse,
        boards: boardsList || [],
      };
    },
  });

  // Load boards and tasks
  const fetchAll = async () => {
    setLoading(true);
    try {
      const boardsList = await apiClient.getBoards();
      setBoards(boardsList || []);

      // Load tasks for each board
      const tasksMap: Record<number, Task[]> = {};
      await Promise.all(
        (boardsList || []).map(async (board) => {
          try {
            const response = await apiClient.getTasksList({ board_id: board.id });
            const tasks = response.groups?.flatMap((g: any) => g.tasks || []) || [];
            tasksMap[board.id] = tasks.sort((a: Task, b: Task) => (a.sort || 0) - (b.sort || 0));
          } catch (error) {
            console.error(`Error loading tasks for board ${board.id}:`, error);
            tasksMap[board.id] = [];
          }
        })
      );
      setTasksByBoard(tasksMap);
    } catch (error) {
      console.error('Error fetching boards:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const startBoardLoading = (boardId: number) => {
    setLoadingBoards((prev) => new Set(prev).add(boardId));
  };

  const stopBoardLoading = (boardId: number) => {
    setLoadingBoards((prev) => {
      const next = new Set(prev);
      next.delete(boardId);
      return next;
    });
  };

  const handleCreateTask = async (boardId: number, taskData: Partial<Task>) => {
    startBoardLoading(boardId);
    try {
      const task = await apiClient.createTask(boardId, taskData);
      setTasksByBoard((prev) => ({
        ...prev,
        [boardId]: [task, ...(prev[boardId] || [])],
      }));
    } catch (error) {
      console.error('Error creating task:', error);
    } finally {
      stopBoardLoading(boardId);
    }
  };

  const handleTaskSave = async (taskData: Partial<Task>) => {
    if (!taskData.board_id) return;

    try {
      if (taskData.id) {
        const updated = await apiClient.updateTask(taskData.board_id, taskData.id, taskData);
        setTasksByBoard((prev) => {
          const boardTasks = prev[taskData.board_id!] || [];
          const index = boardTasks.findIndex((t) => t.id === updated.id);
          if (index >= 0) {
            boardTasks[index] = updated;
          } else {
            boardTasks.unshift(updated);
          }
          return { ...prev, [taskData.board_id!]: boardTasks };
        });
      }
      setTaskDialogOpen(false);
      setSelectedTask(null);
      queryClient.invalidateQueries({ queryKey: ['tasks-list'] });
    } catch (error) {
      console.error('Error saving task:', error);
      throw error;
    }
  };

  const handleTaskDelete = async (task: Task) => {
    if (!task.board_id) return;
    try {
      await apiClient.deleteTask(task.board_id, task.id);
      setTasksByBoard((prev) => ({
        ...prev,
        [task.board_id!]: (prev[task.board_id!] || []).filter((t) => t.id !== task.id),
      }));
      setTaskDialogOpen(false);
      setSelectedTask(null);
    } catch (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
  };

  const handleTaskMove = async (task: Task, toBoardId: number, newIndex: number) => {
    const fromBoardId = task.board_id;
    if (!fromBoardId) return;

    // Update local state optimistically
    setTasksByBoard((prev) => {
      const from = prev[fromBoardId] || [];
      const to = prev[toBoardId] || [];
      
      // Remove from old board
      const updatedFrom = from.filter((t) => t.id !== task.id);
      
      // Add to new board at position
      const updatedTo = [...to];
      updatedTo.splice(newIndex, 0, { ...task, board_id: toBoardId });
      
      // Recalculate sort
      updatedTo.forEach((t, i) => (t.sort = i * 10));
      updatedFrom.forEach((t, i) => (t.sort = i * 10));

      return {
        ...prev,
        [fromBoardId]: updatedFrom,
        [toBoardId]: updatedTo,
      };
    });

    // Save to server
    try {
      await apiClient.updateTask(toBoardId, task.id, {
        board_id: toBoardId,
        sort: newIndex * 10,
      });
    } catch (error) {
      console.error('Error moving task:', error);
      // Revert on error
      fetchAll();
    }
  };

  const handleColumnDragStart = (boardId: number) => {
    setDraggedColumn(boardId);
  };

  const handleColumnDrop = async (draggedId: number, targetId: number) => {
    if (draggedId === targetId) {
      setDraggedColumn(null);
      return;
    }

    const draggedIndex = boards.findIndex((b) => b.id === draggedId);
    const targetIndex = boards.findIndex((b) => b.id === targetId);
    
    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedColumn(null);
      return;
    }

    // Update local state
    const newBoards = [...boards];
    const [removed] = newBoards.splice(draggedIndex, 1);
    newBoards.splice(targetIndex, 0, removed);
    setBoards(newBoards);

    // Save to server
    try {
      const ids = newBoards.map((b) => b.id);
      await apiClient.reorderBoards(ids);
    } catch (error) {
      console.error('Error reordering boards:', error);
      fetchAll();
    }

    setDraggedColumn(null);
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setTaskDialogOpen(true);
    onTaskClick?.(task);
  };

  const handleCreateBoard = async () => {
    const name = prompt('Введіть назву нової дошки:');
    if (!name) return;

    try {
      const newBoard = await apiClient.createBoard(name);
      setBoards((prev) => [...prev, newBoard]);
      setTasksByBoard((prev) => ({ ...prev, [newBoard.id]: [] }));
    } catch (error) {
      console.error('Error creating board:', error);
      alert('Помилка створення дошки');
    }
  };

  if (!subdata) {
    return <div className="kanban-loading">Завантаження...</div>;
  }

  return (
    <div className="kanban-board-container">
      {/* Header */}
      <div className="kanban-header">
        <div className="kanban-header-left">
          <h1 className="kanban-title">Канбан дошки</h1>
          <span className="kanban-boards-count">{boards.length} колонок</span>
        </div>
        <div className="kanban-header-right">
          <button className="kanban-btn kanban-btn-refresh" onClick={fetchAll} disabled={loading}>
            <IconRefresh size={18} />
            Оновити
          </button>
          <button className="kanban-btn kanban-btn-primary" onClick={handleCreateBoard}>
            <IconPlus size={18} />
            Додати колонку
          </button>
        </div>
      </div>

      {/* Columns */}
      <div className="kanban-columns-wrapper">
        <div className="kanban-columns">
          {boards.map((board) => (
            <KanbanColumn
              key={board.id}
              board={board}
              tasks={tasksByBoard[board.id] || []}
              loading={loadingBoards.has(board.id)}
              onTaskClick={handleTaskClick}
              onTaskMove={handleTaskMove}
              onTaskCreate={handleCreateTask}
              onTaskDelete={handleTaskDelete}
              onColumnDragStart={handleColumnDragStart}
              onColumnDrop={handleColumnDrop}
              isDragged={draggedColumn === board.id}
            />
          ))}
          <div className="kanban-add-column">
            <button className="kanban-add-column-btn" onClick={handleCreateBoard}>
              <IconPlus size={20} />
              <span>Додати колонку</span>
            </button>
          </div>
        </div>
      </div>

      {/* Task Dialog */}
      {taskDialogOpen && subdata && (
        <TaskDialog
          open={taskDialogOpen}
          task={selectedTask}
          subdata={subdata}
          onClose={() => {
            setTaskDialogOpen(false);
            setSelectedTask(null);
          }}
          onSave={handleTaskSave}
          onDelete={handleTaskDelete}
        />
      )}
    </div>
  );
};

export default KanbanBoard;

