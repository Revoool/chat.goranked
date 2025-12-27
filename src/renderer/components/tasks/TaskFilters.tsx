import React from 'react';
import { TaskFilters as TaskFiltersType, TasksSubdata } from '../../types';
import '../../styles/TaskFilters.css';

interface TaskFiltersProps {
  filters: TaskFiltersType;
  subdata: TasksSubdata;
  onChange: (filters: TaskFiltersType) => void;
}

const TaskFilters: React.FC<TaskFiltersProps> = ({ filters, subdata, onChange }) => {
  const handleCategoryChange = (categoryId: number | null) => {
    onChange({ ...filters, category_id: categoryId || undefined });
  };

  const handleStatusChange = (statusId: number | null) => {
    onChange({ ...filters, status_id: statusId || undefined });
  };

  const handleAssigneeChange = (assigneeId: number | null) => {
    onChange({ ...filters, assignee_id: assigneeId || undefined });
  };

  return (
    <div className="task-filters">
      {/* Category Filter */}
      <select
        className="task-filter-select"
        value={filters.category_id || ''}
        onChange={(e) => handleCategoryChange(e.target.value ? parseInt(e.target.value) : null)}
      >
        <option value="">Категорія</option>
        {subdata.categories?.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>

      {/* Status Filter */}
      <select
        className="task-filter-select"
        value={filters.status_id || ''}
        onChange={(e) => handleStatusChange(e.target.value ? parseInt(e.target.value) : null)}
      >
        <option value="">Статус</option>
        {subdata.statuses?.map((status) => (
          <option key={status.id} value={status.id}>
            {status.name}
          </option>
        ))}
      </select>

      {/* Assignee Filter */}
      <select
        className="task-filter-select"
        value={filters.assignee_id || ''}
        onChange={(e) => handleAssigneeChange(e.target.value ? parseInt(e.target.value) : null)}
      >
        <option value="">Виконавець</option>
        {subdata.users?.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default TaskFilters;

