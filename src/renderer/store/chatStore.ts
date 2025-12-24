import { create } from 'zustand';
import { Chat, ChatFilters } from '../types';

type MenuItem = 'inbox' | 'assigned' | 'closed' | 'settings';

interface ChatState {
  selectedChatId: number | null;
  filters: ChatFilters;
  chats: Chat[];
  activeMenu: MenuItem;
  isClientCardOpen: boolean;
  setSelectedChat: (chatId: number | null) => void;
  setFilters: (filters: Partial<ChatFilters>) => void;
  setChats: (chats: Chat[]) => void;
  updateChat: (chatId: number, updates: Partial<Chat>) => void;
  addChat: (chat: Chat) => void;
  setActiveMenu: (menu: MenuItem) => void;
  toggleClientCard: () => void;
  setClientCardOpen: (isOpen: boolean) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  selectedChatId: null,
  filters: {},
  chats: [],
  activeMenu: 'inbox',
  isClientCardOpen: false,
  setSelectedChat: (chatId) => set({ selectedChatId: chatId, isClientCardOpen: false }), // Close card when switching chats
  setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),
  setChats: (chats) => {
    console.log('💾 Setting chats in store:', chats.length, 'chats');
    console.log('💾 Chats data:', chats);
    set({ chats });
  },
  updateChat: (chatId, updates) =>
    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id === chatId ? { ...chat, ...updates } : chat
      ),
    })),
  addChat: (chat) =>
    set((state) => ({
      chats: [chat, ...state.chats.filter((c) => c.id !== chat.id)],
    })),
  setActiveMenu: (menu) => set({ activeMenu: menu }),
  toggleClientCard: () => set((state) => ({ isClientCardOpen: !state.isClientCardOpen })),
  setClientCardOpen: (isOpen) => set({ isClientCardOpen: isOpen }),
}));

