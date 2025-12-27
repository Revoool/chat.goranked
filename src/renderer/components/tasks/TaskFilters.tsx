import React, { useState, useRef, useEffect } from 'react';
import { TaskFilters as TaskFiltersType, TasksSubdata, User } from '../../types';
import '../../styles/TaskFilters.css';

interface TaskFiltersProps {
  filters: TaskFiltersType;
  subdata: TasksSubdata;
  onChange: (filters: TaskFiltersType) => void;
}

const TaskFilters: React.FC<TaskFiltersProps> = ({ filters, subdata, onChange }) => {
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);
  const assigneeDropdownRef = useRef<HTMLDivElement>(null);

  const handleCategoryChange = (categoryId: number | null) => {
    onChange({ ...filters, category_id: categoryId || undefined });
  };

  const handleStatusChange = (statusId: number | null) => {
    onChange({ ...filters, status_id: statusId || undefined });
  };

  const handleAssigneeChange = (assigneeId: number | null) => {
    onChange({ ...filters, assignee_id: assigneeId || undefined });
    setAssigneeDropdownOpen(false);
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

  const selectedAssignee = subdata.users?.find(u => u.id === filters.assignee_id);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (assigneeDropdownRef.current && !assigneeDropdownRef.current.contains(event.target as Node)) {
        setAssigneeDropdownOpen(false);
      }
    };

    if (assigneeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [assigneeDropdownOpen]);

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

      {/* Assignee Filter - Custom Dropdown */}
      <div className="task-filter-assignee-wrapper" ref={assigneeDropdownRef}>
        <button
          className="task-filter-assignee-btn"
          onClick={() => setAssigneeDropdownOpen(!assigneeDropdownOpen)}
          type="button"
        >
          {selectedAssignee ? (
            <>
              <div
                className="assignee-avatar-small"
                style={{
                  backgroundColor: selectedAssignee.avatar ? 'transparent' : getAssigneeColor(selectedAssignee.id),
                }}
              >
                {selectedAssignee.avatar ? (
                  <img src={selectedAssignee.avatar} alt={selectedAssignee.name} />
                ) : (
                  <span className="assignee-initials-small">{getInitials(selectedAssignee.name)}</span>
                )}
              </div>
              <span className="assignee-name-text">{selectedAssignee.name}</span>
            </>
          ) : (
            <span className="assignee-placeholder">Відповідальні</span>
          )}
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {assigneeDropdownOpen && (
          <div className="task-filter-assignee-dropdown">
            <div
              className={`task-filter-assignee-item ${!filters.assignee_id ? 'active' : ''}`}
              onClick={() => handleAssigneeChange(null)}
            >
              <div className="assignee-avatar-small assignee-avatar-empty">
                <span>—</span>
              </div>
              <span>Всі відповідальні</span>
            </div>
            {subdata.users?.map((user) => (
              <div
                key={user.id}
                className={`task-filter-assignee-item ${filters.assignee_id === user.id ? 'active' : ''}`}
                onClick={() => handleAssigneeChange(user.id)}
              >
                <div
                  className="assignee-avatar-small"
                  style={{
                    backgroundColor: user.avatar ? 'transparent' : getAssigneeColor(user.id),
                  }}
                >
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} />
                  ) : (
                    <span className="assignee-initials-small">{getInitials(user.name)}</span>
                  )}
                </div>
                <div className="assignee-info">
                  <span className="assignee-name">{user.name}</span>
                  {user.role && (
                    <span className="assignee-role">{user.role}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskFilters;
