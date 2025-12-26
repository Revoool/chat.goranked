import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useChatStore } from '../store/chatStore';
import '../styles/Modal.css';

interface NoteModalProps {
  chatId: number;
  onClose: () => void;
}

const NoteModal: React.FC<NoteModalProps> = ({ chatId, onClose }) => {
  const { chats } = useChatStore();
  const queryClient = useQueryClient();
  const chat = chats.find(c => c.id === chatId);
  
  const [note, setNote] = useState('');
  const [clientNickname, setClientNickname] = useState('');
  const [originalNote, setOriginalNote] = useState('');
  const [originalNickname, setOriginalNickname] = useState('');

  // Load current note and nickname from chat metadata
  useEffect(() => {
    if (chat?.metadata) {
      const currentNote = chat.metadata.note || '';
      const currentNickname = chat.metadata.client_nickname || '';
      setNote(currentNote);
      setClientNickname(currentNickname);
      setOriginalNote(currentNote);
      setOriginalNickname(currentNickname);
    }
  }, [chat]);

  const updateNoteMutation = useMutation({
    mutationFn: async (newNote: string | null) => {
      return apiClient.updateChatNote(chatId, newNote);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      queryClient.invalidateQueries({ queryKey: ['chat', chatId] });
    },
    onError: (error: any) => {
      console.error('❌ Error updating note:', error);
      alert(`Помилка: ${error.response?.data?.message || error.message || 'Не вдалося оновити нотатку'}`);
    },
  });

  const updateNicknameMutation = useMutation({
    mutationFn: async (newNickname: string | null) => {
      return apiClient.updateClientNickname(chatId, newNickname);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      queryClient.invalidateQueries({ queryKey: ['chat', chatId] });
    },
    onError: (error: any) => {
      console.error('❌ Error updating nickname:', error);
      alert(`Помилка: ${error.response?.data?.message || error.message || 'Не вдалося оновити ім\'я клієнта'}`);
    },
  });

  const handleSave = () => {
    const noteChanged = note !== originalNote;
    const nicknameChanged = clientNickname !== originalNickname;

    if (noteChanged) {
      updateNoteMutation.mutate(note.trim() || null);
    }
    if (nicknameChanged) {
      updateNicknameMutation.mutate(clientNickname.trim() || null);
    }

    if (!noteChanged && !nicknameChanged) {
      onClose();
    } else if (!updateNoteMutation.isPending && !updateNicknameMutation.isPending) {
      // Wait a bit for mutations to complete
      setTimeout(() => {
        onClose();
      }, 300);
    }
  };

  const isLoading = updateNoteMutation.isPending || updateNicknameMutation.isPending;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Нотатки та ім'я клієнта</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-section">
            <label htmlFor="client-nickname">Ім'я клієнта (для відображення в списку):</label>
            <input
              id="client-nickname"
              type="text"
              className="form-input"
              placeholder="Наприклад: вова заказ 111"
              value={clientNickname}
              onChange={(e) => setClientNickname(e.target.value)}
              maxLength={255}
            />
            <p className="form-hint">
              Це ім'я буде видно всім менеджерам у списку чатів. Оригінальне ім'я клієнта не змінюється.
            </p>
          </div>

          <div className="form-section">
            <label htmlFor="chat-note">Нотатка до чату:</label>
            <textarea
              id="chat-note"
              className="form-textarea"
              placeholder="Внутрішні нотатки про цей чат (видимі всім менеджерам)..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={6}
              maxLength={5000}
            />
            <p className="form-hint">
              Нотатка буде видна всім менеджерам у цьому чаті.
            </p>
          </div>

          <div className="modal-actions">
            <button
              className="modal-btn primary"
              onClick={handleSave}
              disabled={isLoading}
            >
              {isLoading ? 'Збереження...' : 'Зберегти'}
            </button>
            <button className="modal-btn secondary" onClick={onClose}>
              Скасувати
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NoteModal;

