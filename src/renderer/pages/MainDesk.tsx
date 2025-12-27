import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import Sidebar from '../components/Sidebar';
import ChatList from '../components/ChatList';
import ChatWindow from '../components/ChatWindow';
import ClientCard from '../components/ClientCard';
import Settings from '../components/Settings';
import TasksList from '../components/tasks/TasksList';
import TaskDialog from '../components/tasks/TaskDialog';
import { useChatStore } from '../store/chatStore';
import { apiClient } from '../api/client';
import { Task, TasksSubdata } from '../types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import '../styles/MainDesk.css';

const MainDesk: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { selectedChatId, activeMenu, isClientCardOpen } = useChatStore();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  // Load tasks subdata for TaskDialog
  const { data: tasksSubdata } = useQuery<TasksSubdata>({
    queryKey: ['tasks-subdata'],
    queryFn: async () => {
      const subdataResponse = await apiClient.getBoardsSubdata();
      const boards = await apiClient.getBoards();
      return {
        ...subdataResponse,
        boards: boards || [],
      };
    },
    enabled: activeMenu === 'tasks' || taskDialogOpen,
  });

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setTaskDialogOpen(true);
  };

  const handleTaskSave = async (taskData: Partial<Task>) => {
    if (!taskData.board_id) {
      // For new tasks, use first available board or create one
      const boards = await apiClient.getBoards();
      if (boards.length === 0) {
        throw new Error('Немає доступних дошок. Створіть дошку спочатку.');
      }
      taskData.board_id = boards[0].id;
    }

    if (taskData.id) {
      // Update existing task
      if (taskData.board_id && taskData.id) {
        await apiClient.updateTask(taskData.board_id, taskData.id, taskData);
      }
    } else {
      // Create new task
      await apiClient.createTask(taskData.board_id, taskData);
    }

    // Invalidate queries to refresh tasks list
    queryClient.invalidateQueries({ queryKey: ['tasks-list'] });
    queryClient.invalidateQueries({ queryKey: ['tasks-subdata'] });
  };

  const handleTaskDelete = async (task: Task) => {
    if (!task.board_id) {
      throw new Error('Немає дошки для задачі');
    }
      if (task.board_id) {
        await apiClient.deleteTask(task.board_id, task.id);
      }
    queryClient.invalidateQueries({ queryKey: ['tasks-list'] });
  };

  const handleTaskDialogClose = () => {
    setTaskDialogOpen(false);
    setSelectedTask(null);
  };

  return (
    <div className="main-desk">
      <Sidebar user={user} onLogout={logout} />
      <div className="main-content">
        {activeMenu === 'settings' ? (
          <Settings />
        ) : activeMenu === 'tasks' ? (
          <TasksList onTaskClick={handleTaskClick} />
        ) : (
          <>
            <ChatList />
            <div className="chat-area">
              {selectedChatId ? (
                <>
                  <ChatWindow chatId={selectedChatId} />
                  {isClientCardOpen && <ClientCard chatId={selectedChatId} />}
                </>
              ) : (
                <div className="empty-chat">
                  <p>Выберите чат для начала работы</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Task Dialog */}
      {taskDialogOpen && tasksSubdata && (
        <TaskDialog
          open={taskDialogOpen}
          task={selectedTask}
          subdata={tasksSubdata}
          onClose={handleTaskDialogClose}
          onSave={handleTaskSave}
          onDelete={handleTaskDelete}
        />
      )}
    </div>
  );
};

export default MainDesk;

