import React, { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Task, TasksSubdata, TaskComment } from '../../types';
import { apiClient } from '../../api/client';
import { IconX, IconCheck, IconPaperclip, IconPhoto, IconSend, IconTrash, IconLink, IconFlag } from '../../icons';
import '../../styles/TaskDialog.css';

interface TaskDialogProps {
  open: boolean;
  task: Task | null;
  subdata: TasksSubdata;
  onClose: () => void;
  onSave: (taskData: Partial<Task>) => Promise<void>;
  onDelete?: (task: Task) => Promise<void>;
}

const TaskDialog: React.FC<TaskDialogProps> = ({ open, task, subdata, onClose, onSave, onDelete }) => {
  const [localTask, setLocalTask] = useState<Partial<Task>>({});
  const [orderSearch, setOrderSearch] = useState('');
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [orderLoading, setOrderLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [newComment, setNewComment] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [sendingComment, setSendingComment] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load comments when task is opened
  const { data: comments = [], refetch: refetchComments, isLoading: loadingComments } = useQuery<TaskComment[]>({
    queryKey: ['task-comments', localTask.id, localTask.board_id],
    queryFn: async () => {
      if (!localTask.id || !localTask.board_id || localTask.id === 0) return [];
      return await apiClient.getTaskComments(localTask.board_id, localTask.id);
    },
    enabled: open && !!localTask.id && !!localTask.board_id && localTask.id !== 0,
  });

  // Initialize local task data
  useEffect(() => {
    if (task && task.id !== 0) {
      const taskData = { ...task };
      if (taskData.assignees && Array.isArray(taskData.assignees)) {
        taskData.assignee_ids = taskData.assignees.map(a => (typeof a === 'object' && a.id ? a.id : a)).filter((id): id is number => typeof id === 'number');
      } else if (!taskData.assignee_ids) {
        taskData.assignee_ids = taskData.user_id ? [taskData.user_id] : [];
      }
      setLocalTask(taskData);

      // Load order info if exists
      if (taskData.order_id && taskData.order_type) {
        searchOrders(String(taskData.order_id));
      } else {
        setOrderSearch('');
        setOrderItems([]);
        setSelectedOrder(null);
      }
    } else {
      // New task defaults
      const newTask: Partial<Task> = {
        name: task?.name || '',
        content: task?.content || '',
        board_id: task?.board_id || subdata.boards?.[0]?.id || undefined,
        status_id: task?.status_id || subdata.statuses?.[0]?.id || undefined,
        assignee_ids: task?.assignee_ids || [],
        category_id: task?.category_id || subdata.categories?.[0]?.id || undefined,
        finish_at: task?.finish_at || undefined,
        is_priority: task?.is_priority || false,
        order_id: task?.order_id || undefined,
        order_type: task?.order_type || undefined,
      };
      setLocalTask(newTask);
      setOrderSearch('');
      setOrderItems([]);
      setSelectedOrder(null);
    }
  }, [task, subdata]);

  // Clear comment form when dialog closes
  useEffect(() => {
    if (!open) {
      setNewComment('');
      removeFile();
    }
  }, [open]);

  const searchOrders = async (search: string) => {
    if (!localTask.order_type) {
      setOrderItems([]);
      return;
    }

    setOrderLoading(true);
    try {
      const results = await apiClient.searchOrders({
        type: localTask.order_type!,
        search: search || '',
        limit: 20,
      });
      setOrderItems(results);

      // If searching by ID and found exact match
      if (search && localTask.order_id) {
        const found = results.find((o: any) => o.id === localTask.order_id);
        if (found) {
          setSelectedOrder(found);
          setOrderSearch(`${found.title} - ${found.subtitle}`);
        }
      }
    } catch (error) {
      console.error('Error searching orders:', error);
    } finally {
      setOrderLoading(false);
    }
  };

  const selectOrder = (orderId: number | null) => {
    if (!orderId) {
      setLocalTask({ ...localTask, order_id: undefined, order_type: undefined });
      setSelectedOrder(null);
      setOrderSearch('');
      return;
    }

    const found = orderItems.find((o: any) => o.id === orderId);
    if (found) {
      setSelectedOrder(found);
      setLocalTask({ ...localTask, order_id: found.id, order_type: found.type });
      setOrderSearch(`${found.title} - ${found.subtitle}`);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const sendComment = async () => {
    if ((!newComment.trim() && !selectedFile) || !localTask.id || !localTask.board_id || localTask.id === 0 || sendingComment) return;
    if (typeof localTask.board_id !== 'number' || typeof localTask.id !== 'number') return;

    setSendingComment(true);
    try {
      await apiClient.createTaskComment(
        localTask.board_id,
        localTask.id,
        newComment.trim() || '',
        selectedFile || undefined
      );
      setNewComment('');
      removeFile();
      refetchComments();
    } catch (error) {
      console.error('Error sending comment:', error);
      alert('Помилка при додаванні коментаря');
    } finally {
      setSendingComment(false);
    }
  };

  const deleteComment = async (commentId: number) => {
    if (!localTask.id || !localTask.board_id || typeof localTask.board_id !== 'number' || typeof localTask.id !== 'number') return;
    if (!confirm('Ви впевнені, що хочете видалити цей коментар?')) return;

    try {
      await apiClient.deleteTaskComment(localTask.board_id, localTask.id, commentId);
      refetchComments();
    } catch (error) {
      console.error('Error deleting comment:', error);
      alert('Помилка при видаленні коментаря');
    }
  };

  const handleSave = async () => {
    if (!localTask.board_id) {
      alert('Помилка: не вказано дошку для задачі');
      return;
    }

    try {
      await onSave(localTask);
      onClose();
    } catch (error: any) {
      console.error('Error saving task:', error);
      let errorMessage = 'Помилка збереження задачі';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.errors) {
        const errors = Object.values(error.response.data.errors).flat();
        errorMessage = errors.join('\n');
      } else if (error.message) {
        errorMessage = error.message;
      }
      alert(errorMessage);
    }
  };

  const handleDelete = async () => {
    if (!task || !onDelete) return;
    try {
      await onDelete(task);
      setDeleteDialog(false);
      onClose();
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Помилка при видаленні задачі');
    }
  };

  const formatCommentDate = (dateString?: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'щойно';
    if (diffMins < 60) return `${diffMins} хв. тому`;
    if (diffHours < 24) return `${diffHours} год. тому`;
    if (diffDays < 7) return `${diffDays} дн. тому`;

    return date.toLocaleDateString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getTaskLink = (): string => {
    if (!localTask.id) return '';
    return `${window.location.origin}${window.location.pathname}?task=${localTask.id}`;
  };

  const copyTaskLink = async () => {
    const link = getTaskLink();
    if (!link) {
      alert('Задачу ще не збережено');
      return;
    }

    try {
      await navigator.clipboard.writeText(link);
      alert('Посилання скопійовано');
    } catch (err) {
      const textArea = document.createElement('textarea');
      textArea.value = link;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        alert('Посилання скопійовано');
      } catch (e) {
        console.error('Failed to copy:', e);
      }
      document.body.removeChild(textArea);
    }
  };

  const selectedStatus = subdata.statuses?.find(s => s.id === localTask.status_id) || null;
  const selectedCategory = subdata.categories?.find(c => c.id === localTask.category_id) || null;
  const selectedAssignees = subdata.users?.filter(u => localTask.assignee_ids?.includes(u.id)) || [];

  const authorUser = task?.author || null;
  const completedByUser = task?.completed_by_user || null;
  const isCompleted = !!(task?.completed_by && task?.completed_at);

  const formatDate = (dateString?: string): string => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!open) return null;

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="task-dialog-content" onClick={(e) => e.stopPropagation()}>
          {/* Toolbar */}
          <div className="task-dialog-toolbar">
            <div className="task-dialog-title-group">
              <input
                type="text"
                className="task-dialog-name"
                placeholder="Назва картки"
                value={localTask.name || ''}
                onChange={(e) => setLocalTask({ ...localTask, name: e.target.value })}
                autoFocus
              />
              {localTask.id && localTask.id !== 0 && (
                <div className="task-dialog-meta">
                  <span className="task-dialog-id">ID: {localTask.id}</span>
                  <button className="task-dialog-link-btn" onClick={copyTaskLink} title="Скопіювати посилання">
                    <IconLink size={16} />
                  </button>
                  {authorUser && (
                    <div className="task-dialog-author" title={`Створено: ${formatDate(task?.created_at)}`}>
                      <div className="author-avatar">
                        {authorUser.avatar ? (
                          <img src={authorUser.avatar} alt={authorUser.name} />
                        ) : (
                          <span>{authorUser.name?.charAt(0).toUpperCase() || '?'}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="task-dialog-actions">
              {localTask.id && localTask.id !== 0 && onDelete && (
                <button className="task-dialog-btn task-dialog-btn-delete" onClick={() => setDeleteDialog(true)}>
                  <IconTrash size={16} />
                  Видалити
                </button>
              )}
              <button className="task-dialog-btn task-dialog-btn-save" onClick={handleSave}>
                <IconCheck size={16} />
                Зберегти
              </button>
              <button className="task-dialog-btn task-dialog-btn-close" onClick={onClose}>
                <IconX size={20} />
              </button>
            </div>
          </div>

          <div className="task-dialog-divider" />

          {/* Body */}
          <div className="task-dialog-body">
            <div className="task-dialog-main">
              {/* Description */}
              <section className="task-dialog-section">
                <label className="task-dialog-section-label">Опис</label>
                <textarea
                  className="task-dialog-textarea"
                  rows={6}
                  placeholder="Додайте деталі, чеклісти або посилання..."
                  value={localTask.content || ''}
                  onChange={(e) => setLocalTask({ ...localTask, content: e.target.value })}
                />
              </section>

              {/* Summary */}
              <section className="task-dialog-section">
                <label className="task-dialog-section-label">Зведення</label>
                <div className="task-dialog-chips">
                  {selectedStatus && (
                    <span className="task-dialog-chip" style={{ backgroundColor: selectedStatus.color + '20', color: selectedStatus.color }}>
                      {selectedStatus.name}
                    </span>
                  )}
                  {selectedAssignees.map((assignee) => (
                    <span key={assignee.id} className="task-dialog-chip task-dialog-chip-muted">
                      {assignee.name}
                    </span>
                  ))}
                  {localTask.finish_at && (
                    <span className="task-dialog-chip task-dialog-chip-muted">
                      {new Date(localTask.finish_at).toLocaleDateString('uk-UA')}
                    </span>
                  )}
                </div>
              </section>

              {/* Completed Info */}
              {isCompleted && completedByUser && (
                <section className="task-dialog-section task-dialog-completed-info">
                  <label className="task-dialog-section-label">Виконано</label>
                  <div className="task-dialog-completed-details">
                    <div className="completed-user">
                      <div className="completed-user-avatar">
                        {completedByUser.avatar ? (
                          <img src={completedByUser.avatar} alt={completedByUser.name} />
                        ) : (
                          <span>{completedByUser.name?.charAt(0).toUpperCase() || '?'}</span>
                        )}
                      </div>
                      <div className="completed-user-info">
                        <div className="completed-user-name">{completedByUser.name || 'Невідомий користувач'}</div>
                        <div className="completed-user-date">{formatDate(task?.completed_at)}</div>
                      </div>
                      <IconCheck size={20} className="text-success" />
                    </div>
                  </div>
                </section>
              )}

              {/* Comments */}
              {localTask.id && localTask.id !== 0 && (
                <section className="task-dialog-section task-dialog-comments">
                  <label className="task-dialog-section-label">Коментарі</label>

                  {/* Comments List */}
                  <div className="task-dialog-comments-list">
                    {loadingComments ? (
                      <div className="loading-spinner" />
                    ) : comments.length === 0 ? (
                      <div className="text-muted text-center">Немає коментарів</div>
                    ) : (
                      <div className="comments-list">
                        {comments.map((comment) => (
                          <div key={comment.id} className="task-dialog-comment">
                            <div className="comment-header">
                              <div className="comment-user-avatar">
                                {comment.user?.avatar ? (
                                  <img src={comment.user.avatar} alt={comment.user.name} />
                                ) : (
                                  <span>{comment.user?.name?.charAt(0).toUpperCase() || '?'}</span>
                                )}
                              </div>
                              <div className="comment-content">
                                <div className="comment-header-info">
                                  <span className="comment-user-name">{comment.user?.name || 'Невідомий користувач'}</span>
                                  <span className="comment-date">{formatCommentDate(comment.created_at)}</span>
                                </div>
                                {comment.comment && (
                                  <div className="comment-text">{comment.comment}</div>
                                )}
                                {comment.file_path && (
                                  <div className="comment-image">
                                    <img src={comment.file_path} alt="Attachment" />
                                  </div>
                                )}
                              </div>
                              <button
                                className="comment-delete-btn"
                                onClick={() => deleteComment(comment.id)}
                                title="Видалити коментар"
                              >
                                <IconTrash size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Comment Form */}
                  <form className="task-dialog-comment-form" onSubmit={(e) => { e.preventDefault(); sendComment(); }}>
                    <textarea
                      className="comment-textarea"
                      rows={3}
                      placeholder="Додати коментар..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                          e.preventDefault();
                          sendComment();
                        }
                      }}
                    />

                    {/* File Preview */}
                    {filePreview && (
                      <div className="task-dialog-file-preview">
                        <img src={filePreview} alt="Preview" />
                        <div className="file-preview-info">
                          <div className="file-preview-name">{selectedFile?.name}</div>
                          <div className="file-preview-size">{formatFileSize(selectedFile?.size)}</div>
                        </div>
                        <button type="button" className="file-preview-remove" onClick={removeFile}>
                          <IconX size={16} />
                        </button>
                      </div>
                    )}

                    {/* Comment Actions */}
                    <div className="comment-actions">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleFileSelect}
                      />
                      <button
                        type="button"
                        className="comment-action-btn"
                        onClick={openFileDialog}
                        title="Додати зображення"
                      >
                        <IconPhoto size={18} />
                      </button>
                      <button
                        type="submit"
                        className="comment-action-btn comment-action-btn-send"
                        disabled={(!newComment.trim() && !selectedFile) || sendingComment}
                        title="Відправити (Ctrl+Enter)"
                      >
                        {sendingComment ? '...' : <IconSend size={18} />}
                      </button>
                    </div>
                  </form>
                </section>
              )}
            </div>

            {/* Sidebar */}
            <div className="task-dialog-sidebar">
              {/* Category */}
              <section className="task-dialog-section">
                <label className="task-dialog-section-label">Категорія</label>
                <select
                  className="task-dialog-select"
                  value={localTask.category_id || ''}
                  onChange={(e) => setLocalTask({ ...localTask, category_id: e.target.value ? parseInt(e.target.value) : undefined })}
                >
                  <option value="">Оберіть категорію</option>
                  {subdata.categories?.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </section>

              {/* Status */}
              <section className="task-dialog-section">
                <label className="task-dialog-section-label">Статус</label>
                <select
                  className="task-dialog-select"
                  value={localTask.status_id || ''}
                  onChange={(e) => setLocalTask({ ...localTask, status_id: e.target.value ? parseInt(e.target.value) : undefined })}
                >
                  <option value="">Оберіть статус</option>
                  {subdata.statuses?.map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.name}
                    </option>
                  ))}
                </select>
              </section>

              {/* Assignees */}
              <section className="task-dialog-section">
                <label className="task-dialog-section-label">Відповідальні</label>
                <select
                  className="task-dialog-select task-dialog-select-multiple"
                  multiple
                  value={localTask.assignee_ids?.map(String) || []}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => parseInt(option.value));
                    setLocalTask({ ...localTask, assignee_ids: selected });
                  }}
                >
                  {subdata.users?.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} {user.role ? `— ${user.role}` : ''}
                    </option>
                  ))}
                </select>
                <p className="task-dialog-hint">Утримайте Ctrl для вибору кількох</p>
              </section>

              {/* Order */}
              <section className="task-dialog-section">
                <label className="task-dialog-section-label">Номер замовлення</label>
                <div className="order-select-group">
                  <select
                    className="task-dialog-select"
                    value={localTask.order_type || ''}
                    onChange={(e) => {
                      const orderType = e.target.value || undefined;
                      setLocalTask({ ...localTask, order_type: orderType, order_id: undefined });
                      setOrderSearch('');
                      setOrderItems([]);
                      setSelectedOrder(null);
                    }}
                  >
                    <option value="">Тип замовлення</option>
                    <option value="boost">Послуга (буст)</option>
                    <option value="marketplace">Маркетплейс</option>
                  </select>
                  {localTask.order_type && (
                    <>
                      <input
                        type="text"
                        className="task-dialog-input"
                        placeholder="Введіть ID або знайдіть замовлення"
                        value={orderSearch}
                        onChange={(e) => {
                          setOrderSearch(e.target.value);
                          searchOrders(e.target.value);
                        }}
                        onFocus={() => {
                          if (localTask.order_type && orderItems.length === 0) {
                            searchOrders('');
                          }
                        }}
                      />
                      {orderItems.length > 0 && (
                        <div className="order-dropdown">
                          {orderItems.map((order: any) => (
                            <div
                              key={order.id}
                              className="order-dropdown-item"
                              onClick={() => selectOrder(order.id)}
                            >
                              <div className="order-dropdown-title">{order.title}</div>
                              <div className="order-dropdown-subtitle">{order.subtitle}</div>
                              <span className="order-dropdown-type">
                                {order.type === 'boost' ? 'Буст' : 'Маркет'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {localTask.order_id && localTask.order_type && (
                        <a
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const baseUrl = 'https://goranked.gg';
                            const url = localTask.order_type === 'boost' 
                              ? `${baseUrl}/orders/edit/${localTask.order_id}`
                              : `${baseUrl}/accounts/orders/edit/${localTask.order_id}`;
                            if (window.electronAPI?.openExternal) {
                              window.electronAPI.openExternal(url);
                            } else {
                              window.open(url, '_blank');
                            }
                          }}
                          href="#"
                          rel="noopener noreferrer"
                          className="order-link-btn"
                        >
                          <IconLink size={16} />
                          Відкрити замовлення
                        </a>
                      )}
                    </>
                  )}
                </div>
              </section>

              {/* Deadline */}
              <section className="task-dialog-section">
                <label className="task-dialog-section-label">Дедлайн</label>
                <input
                  type="date"
                  className="task-dialog-input"
                  value={localTask.finish_at ? new Date(localTask.finish_at).toISOString().split('T')[0] : ''}
                  onChange={(e) => setLocalTask({ ...localTask, finish_at: e.target.value || undefined })}
                />
              </section>

              {/* Priority */}
              <section className="task-dialog-section">
                <label className="task-dialog-section-label">
                  <input
                    type="checkbox"
                    checked={localTask.is_priority || false}
                    onChange={(e) => setLocalTask({ ...localTask, is_priority: e.target.checked })}
                    className="task-dialog-checkbox"
                  />
                  <span>Пріоритетна задача</span>
                  {localTask.is_priority && <IconFlag size={16} className="text-error" />}
                </label>
                <p className="task-dialog-hint">Відмітьте, якщо задача потребує негайної уваги</p>
              </section>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteDialog && (
        <div className="modal-overlay" onClick={() => setDeleteDialog(false)}>
          <div className="modal-content delete-confirmation" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Видалити задачу?</h3>
              <button className="modal-close" onClick={() => setDeleteDialog(false)}>×</button>
            </div>
            <div className="modal-body">
              {localTask.name && (
                <div className="delete-task-name">
                  <strong>{localTask.name}</strong>
                </div>
              )}
              <p className="text-muted">
                Дія незворотна. Будуть видалені також усі коментарі до задачі.
              </p>
            </div>
            <div className="modal-actions">
              <button className="modal-btn secondary" onClick={() => setDeleteDialog(false)}>
                Скасувати
              </button>
              <button className="modal-btn error" onClick={handleDelete}>
                Видалити
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TaskDialog;

