import { create } from 'zustand';
import { Chat, ChatFilters } from '../types';

type MenuItem = 'inbox' | 'assigned' | 'closed' | 'settings';

interface TypingInfo {
  isTyping: boolean;
  userId: number | null;
  userName: string | null;
}

interface ChatState {
  selectedChatId: number | null;
  filters: ChatFilters;
  chats: Chat[];
  activeMenu: MenuItem;
  isClientCardOpen: boolean;
  typingIndicators: Record<number, TypingInfo>; // chatId -> typing info
  setSelectedChat: (chatId: number | null) => void;
  setFilters: (filters: Partial<ChatFilters>) => void;
  setChats: (chats: Chat[]) => void;
  updateChat: (chatId: number, updates: Partial<Chat>) => void;
  addChat: (chat: Chat) => void;
  setActiveMenu: (menu: MenuItem) => void;
  toggleClientCard: () => void;
  setClientCardOpen: (isOpen: boolean) => void;
  setTypingIndicator: (chatId: number, typingInfo: TypingInfo | null) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  selectedChatId: null,
  filters: {},
  chats: [],
  activeMenu: 'inbox',
  isClientCardOpen: false,
  typingIndicators: {},
  setSelectedChat: (chatId) => set({ selectedChatId: chatId, isClientCardOpen: false }), // Close card when switching chats
  setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),
  setChats: (chats) => {
    // Ensure chats is always an array
    const safeChats = Array.isArray(chats) ? chats : [];
    console.log('💾 Setting chats in store:', safeChats.length, 'chats');
    console.log('💾 Chats data:', safeChats);
    set({ chats: safeChats });
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
  setTypingIndicator: (chatId, typingInfo) =>
    set((state) => {
      if (!typingInfo) {
        const { [chatId]: _, ...rest } = state.typingIndicators;
        return { typingIndicators: rest };
      }
      return {
        typingIndicators: {
          ...state.typingIndicators,
          [chatId]: typingInfo,
        },
      };
    }),
}));

