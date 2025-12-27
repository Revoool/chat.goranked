import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { Task, TaskGroup, TasksSubdata, TaskFilters as TaskFiltersType } from '../../types';
import TaskRow from './TaskRow';
import TaskFilters from './TaskFilters';
import KanbanBoard from './KanbanBoard';
import { IconChevronDown, IconChevronRight, IconPlus, IconLayoutKanban, IconList } from '../../icons';
import '../../styles/TasksList.css';

interface TasksListProps {
  onTaskClick?: (task: Task) => void;
}

type GroupByType = 'status' | 'finish_at' | 'assignee' | 'board';

const TasksList: React.FC<TasksListProps> = ({ onTaskClick }) => {
  const [filters, setFilters] = useState<TaskFiltersType>({});
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [groupBy, setGroupBy] = useState<GroupByType>('status');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

  // Load subdata
  const { data: subdata, isLoading: loadingSubdata } = useQuery<TasksSubdata>({
    queryKey: ['tasks-subdata'],
    queryFn: async () => {
      const subdataResponse = await apiClient.getBoardsSubdata();
      const boards = await apiClient.getBoards();
      return {
        ...subdataResponse,
        boards: boards || [],
      };
    },
  });

  // Load tasks
  const { data: tasksData, isLoading: loadingTasks, refetch } = useQuery<{ groups: TaskGroup[] }>({
    queryKey: ['tasks-list', filters, selectedCategory, groupBy],
    queryFn: async () => {
      const params: any = {
        group_by: groupBy,
      };
      
      const categoryId = filters.category_id || selectedCategory;
      if (categoryId) params.category_id = categoryId;
      if (filters.status_id) params.status_id = filters.status_id;
      if (filters.assignee_id) params.assignee_id = filters.assignee_id;
      if (filters.board_id) params.board_id = filters.board_id;
      if (filters.status_filter) params.status_filter = filters.status_filter;

      return await apiClient.getTasksList(params);
    },
    enabled: !!subdata,
  });

  // Auto-collapse done groups
  useEffect(() => {
    if (tasksData?.groups) {
      const newCollapsed = new Set<string>();
      tasksData.groups.forEach(group => {
        const label = group.label?.toLowerCase() || '';
        const key = group.key?.toLowerCase() || '';

        if (label.includes('done') || label.includes('виконано') || label.includes('closed') ||
          label.includes('завершено') || label.includes('выполнено')) {
          newCollapsed.add(group.key);
        }

        if (groupBy === 'status' && group.key) {
          if (group.key.startsWith('status_')) {
            const statusId = parseInt(group.key.replace('status_', ''));
            const status = subdata?.statuses?.find(s => s.id === statusId);
            if (status) {
              const statusName = status.name?.toLowerCase() || '';
              if (statusName.includes('done') || statusName.includes('виконано') ||
                statusName.includes('closed') || statusName.includes('завершено')) {
                newCollapsed.add(group.key);
              }
            }
          }
        }
      });
      setCollapsedGroups(newCollapsed);
    }
  }, [tasksData, groupBy, subdata]);

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupKey)) {
        newSet.delete(groupKey);
      } else {
        newSet.add(groupKey);
      }
      return newSet;
    });
  };

  const isGroupCollapsed = (groupKey: string): boolean => {
    return collapsedGroups.has(groupKey);
  };

  const formatGroupLabel = (group: TaskGroup): string => {
    if (groupBy === 'finish_at') {
      const key = group.key?.toLowerCase() || '';
      const label = group.label || '';
      
      if (key === 'done' || label.toLowerCase().includes('done') || 
          label.toLowerCase().includes('виконано') || label.toLowerCase().includes('closed')) {
        return 'Done';
      }
      
      if (key === 'overdue' || label.toLowerCase().includes('прострочено') || 
          label.toLowerCase().includes('overdue')) {
        return 'Overdue';
      }
    }
    
    return group.label || '';
  };

  const handleStatusUpdate = async (data: { taskId: number; statusId: number | null; updatedTask?: Task }) => {
    // Refetch tasks after status update
    await refetch();
  };

  const handleTaskClick = (task: Task) => {
    onTaskClick?.(task);
  };

  const currentDate = useMemo(() => {
    const now = new Date();
    return now.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }, []);

  if (loadingSubdata) {
    return (
      <div className="tasks-loading">
        <div className="loading-spinner" />
        <p>Завантаження...</p>
      </div>
    );
  }

  if (!subdata) {
    return <div className="tasks-error">Помилка завантаження даних</div>;
  }

  // Show Kanban view
  if (viewMode === 'kanban') {
    return (
      <div className="tasks-list-container">
        <div className="tasks-header">
          <div className="tasks-header-left">
            <h1 className="tasks-title">Канбан дошки</h1>
          </div>
          <div className="tasks-header-right">
            <div className="tasks-view-toggle">
              <button
                className="tasks-view-btn"
                onClick={() => setViewMode('list')}
                title="Список"
              >
                <IconList size={18} />
              </button>
              <button
                className="tasks-view-btn active"
                onClick={() => setViewMode('kanban')}
                title="Канбан"
              >
                <IconLayoutKanban size={18} />
              </button>
            </div>
          </div>
        </div>
        <KanbanBoard onTaskClick={onTaskClick} />
      </div>
    );
  }

  return (
    <div className="tasks-list-container">
      {/* Header */}
      <div className="tasks-header">
        <div className="tasks-header-left">
          <h1 className="tasks-title">Sales / Чек Ліст</h1>
          <span className="tasks-status-badge">Активний</span>
        </div>
        <div className="tasks-header-right">
          <div className="tasks-view-toggle">
            <button
              className="tasks-view-btn active"
              onClick={() => setViewMode('list')}
              title="Список"
            >
              <IconList size={18} />
            </button>
            <button
              className="tasks-view-btn"
              onClick={() => setViewMode('kanban')}
              title="Канбан"
            >
              <IconLayoutKanban size={18} />
            </button>
          </div>
          <span className="tasks-date">{currentDate}</span>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="tasks-category-tabs">
        <button
          className={`category-tab ${selectedCategory === null ? 'active' : ''}`}
          onClick={() => setSelectedCategory(null)}
        >
          Всі
        </button>
        {subdata.categories?.map((category) => (
          <button
            key={category.id}
            className={`category-tab ${selectedCategory === category.id ? 'active' : ''}`}
            onClick={() => setSelectedCategory(category.id)}
            style={selectedCategory === category.id && category.color ? {
              backgroundColor: category.color + '20',
              color: category.color,
              borderColor: category.color + '40',
            } : {}}
          >
            {category.color && (
              <span 
                className="category-color-dot"
                style={{ backgroundColor: category.color }}
              />
            )}
            {category.name}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="tasks-filters-wrapper">
        <TaskFilters filters={filters} subdata={subdata} onChange={setFilters} />
      </div>

      {/* Group By Selector */}
      <div className="tasks-group-by">
        <label>Групувати по:</label>
        <select 
          value={groupBy} 
          onChange={(e) => setGroupBy(e.target.value as GroupByType)}
          className="group-by-select"
        >
          <option value="status">Статус</option>
          <option value="finish_at">Дата виконання</option>
          <option value="assignee">Виконавець</option>
          <option value="board">Дошка</option>
        </select>
      </div>

      {/* Tasks List */}
      <div className="tasks-table-wrapper">
        {/* Table Header */}
        <div className="task-list-header">
          <div className="task-list-header-row">
            <div style={{ flex: '0 0 20px', minWidth: '20px' }}></div>
            <div className="task-col-name" style={{ flex: 2, minWidth: '200px' }}>Назва</div>
            <div className="task-col-assignee text-center" style={{ flex: 1, minWidth: '120px' }}>Виконавці</div>
            <div className="task-col-order text-center" style={{ flex: '0.8', minWidth: '100px' }}>Замовлення</div>
            <div className="task-col-due text-center" style={{ flex: 1, minWidth: '100px' }}>Дедлайн</div>
            <div className="task-col-priority text-center" style={{ flex: '0.5', minWidth: '80px' }}>Пріоритет</div>
            <div className="task-col-status text-center" style={{ flex: 1, minWidth: '120px' }}>Статус</div>
            <div className="task-col-start text-center" style={{ flex: 1, minWidth: '120px' }}>Дата початку</div>
          </div>
        </div>

        {/* Groups */}
        {loadingTasks ? (
          <div className="tasks-loading">
            <div className="loading-spinner" />
            <p>Завантаження задач...</p>
          </div>
        ) : tasksData?.groups && tasksData.groups.length === 0 ? (
          <div className="tasks-empty">
            <p>Немає задач</p>
            <button className="btn-primary" onClick={() => onTaskClick?.({
              id: 0,
              board_id: subdata?.boards?.[0]?.id || 0,
              name: '',
              content: '',
              status_id: subdata?.statuses?.[0]?.id || null,
              assignee_ids: [],
              category_id: selectedCategory || null,
              is_priority: false,
            } as Task)}>
              Створити задачу
            </button>
          </div>
        ) : (
          <div className="tasks-groups">
            {tasksData?.groups.map((group) => (
              <div key={group.key} className="task-group">
                {/* Group Header */}
                <div className="task-group-header">
                  <div className="task-group-header-content">
                    <button
                      className="task-group-toggle"
                      onClick={() => toggleGroup(group.key)}
                    >
                      {isGroupCollapsed(group.key) ? (
                        <IconChevronRight size={14} />
                      ) : (
                        <IconChevronDown size={14} />
                      )}
                    </button>
                    <span className="task-group-title">{formatGroupLabel(group)}</span>
                    <span className="task-group-count">{group.tasks.length}</span>
                  </div>
                  <button 
                    className="task-group-add-btn"
                    onClick={() => onTaskClick?.({
                      id: 0,
                      board_id: subdata?.boards?.[0]?.id || 0,
                      name: '',
                      content: '',
                      status_id: subdata?.statuses?.[0]?.id || null,
                      assignee_ids: [],
                      category_id: selectedCategory || null,
                      is_priority: false,
                    } as Task)}
                    title="Додати задачу"
                  >
                    <IconPlus size={16} />
                    Add Task
                  </button>
                </div>

                {/* Group Tasks */}
                {!isGroupCollapsed(group.key) && (
                  <div className="task-group-tasks">
                    {group.tasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        subdata={subdata}
                        onClick={() => handleTaskClick(task)}
                        onStatusUpdated={handleStatusUpdate}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TasksList;

