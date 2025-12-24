import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useChatStore } from '../store/chatStore';
import '../styles/Modal.css';

interface TagsModalProps {
  chatId: number;
  currentTags?: string[];
  onClose: () => void;
}

const TagsModal: React.FC<TagsModalProps> = ({ chatId, currentTags = [], onClose }) => {
  const { updateChat, chats } = useChatStore();
  const queryClient = useQueryClient();
  // Ensure currentTags is always an array
  const safeCurrentTags = Array.isArray(currentTags) ? currentTags : [];
  const [tags, setTags] = useState<string[]>(safeCurrentTags);
  const [newTag, setNewTag] = useState('');

  // Get tags from chat metadata if available
  useEffect(() => {
    const chat = chats.find(c => c.id === chatId);
    if (chat?.metadata?.tags) {
      // Ensure tags is an array
      const chatTags = Array.isArray(chat.metadata.tags) 
        ? chat.metadata.tags 
        : (typeof chat.metadata.tags === 'string' ? [chat.metadata.tags] : []);
      setTags(chatTags);
    } else {
      setTags(safeCurrentTags);
    }
  }, [chatId, chats, safeCurrentTags]);

  const updateTagsMutation = useMutation({
    mutationFn: async (newTags: string[]) => {
      // Update chat metadata with tags
      const chat = chats.find(c => c.id === chatId);
      const currentMetadata = chat?.metadata || {};
      return apiClient.updateChatMetadata(chatId, {
        ...currentMetadata,
        tags: newTags,
      });
    },
    onSuccess: (data) => {
      console.log('✅ Tags updated successfully:', data);
      const chat = chats.find(c => c.id === chatId);
      updateChat(chatId, {
        metadata: {
          ...chat?.metadata,
          tags: tags,
        },
      });
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      queryClient.invalidateQueries({ queryKey: ['chat', chatId] });
      onClose();
    },
    onError: (error: any) => {
      console.error('❌ Error updating tags:', error);
      alert(`Ошибка: ${error.response?.data?.message || error.message || 'Не удалось обновить теги'}`);
    },
  });

  const handleAddTag = () => {
    const trimmedTag = newTag.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      const updatedTags = [...tags, trimmedTag];
      setTags(updatedTags);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleSave = () => {
    updateTagsMutation.mutate(tags);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  // Common tags suggestions
  const commonTags = ['важно', 'срочно', 'вопрос', 'жалоба', 'предложение', 'техподдержка'];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Управление тегами</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="tags-input-section">
            <div className="tags-input-wrapper">
              <input
                type="text"
                className="tags-input"
                placeholder="Введите тег и нажмите Enter"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={handleKeyPress}
              />
              <button className="tags-add-btn" onClick={handleAddTag}>
                Добавить
              </button>
            </div>
            <div className="common-tags">
              <span className="common-tags-label">Часто используемые:</span>
              {commonTags.map((tag) => (
                <button
                  key={tag}
                  className="common-tag"
                  onClick={() => {
                    if (!tags.includes(tag)) {
                      setTags([...tags, tag]);
                    }
                  }}
                  disabled={tags.includes(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="tags-list-section">
            <h4>Текущие теги ({tags.length}):</h4>
            {tags.length === 0 ? (
              <p className="tags-empty">Нет тегов</p>
            ) : (
              <div className="tags-list">
                {tags.map((tag) => (
                  <span key={tag} className="tag-item">
                    {tag}
                    <button
                      className="tag-remove"
                      onClick={() => handleRemoveTag(tag)}
                      title="Удалить тег"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="modal-actions">
            <button
              className="modal-btn primary"
              onClick={handleSave}
              disabled={updateTagsMutation.isPending}
            >
              {updateTagsMutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button className="modal-btn secondary" onClick={onClose}>
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TagsModal;

