import { create } from 'zustand';
import { Chat, ChatFilters } from '../types';

export type MenuItem = 'inbox' | 'assigned' | 'closed' | 'settings' | 'tasks' | 'order-chats' | 'product-chats';
export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

interface TypingInfo {
  isTyping: boolean;
  userId: number | null;
  userName: string | null;
}

interface ChatState {
  selectedChatId: number | null;
  selectedOrderChatId: number | null;
  selectedProductChatId: string | number | null;
  filters: ChatFilters;
  chats: Chat[];
  activeMenu: MenuItem;
  isClientCardOpen: boolean;
  typingIndicators: Record<number | string, TypingInfo>;
  searchQuery: string;
  connectionStatus: ConnectionStatus;
  setSelectedChat: (chatId: number | null) => void;
  setSelectedOrderChat: (orderId: number | null) => void;
  setSelectedProductChat: (orderId: number | null) => void;
  setFilters: (filters: Partial<ChatFilters>) => void;
  setChats: (chats: Chat[]) => void;
  appendChats: (chats: Chat[]) => void;
  updateChat: (chatId: number, updates: Partial<Chat>) => void;
  addChat: (chat: Chat) => void;
  setActiveMenu: (menu: MenuItem) => void;
  toggleClientCard: () => void;
  setClientCardOpen: (isOpen: boolean) => void;
  setTypingIndicator: (chatId: number | string, typingInfo: TypingInfo | null) => void;
  setSearchQuery: (query: string) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  selectedChatId: null,
  selectedOrderChatId: null,
  selectedProductChatId: null,
  filters: {},
  chats: [],
  activeMenu: 'inbox' as MenuItem,
  isClientCardOpen: false,
  typingIndicators: {},
  searchQuery: '',
  connectionStatus: 'disconnected',
  setSelectedChat: (chatId) => set({ selectedChatId: chatId, selectedOrderChatId: null, selectedProductChatId: null, isClientCardOpen: false }),
  setSelectedOrderChat: (orderId) => set({ selectedOrderChatId: orderId, selectedChatId: null, selectedProductChatId: null, isClientCardOpen: false }),
  setSelectedProductChat: (chatId) => set({ selectedProductChatId: chatId, selectedChatId: null, selectedOrderChatId: null, isClientCardOpen: false }),
  setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setChats: (chats) => {
    const safeChats = Array.isArray(chats) ? chats : [];
    set({ chats: safeChats });
  },
  appendChats: (newChats) => {
    const safeNewChats = Array.isArray(newChats) ? newChats : [];
    set((state) => {
      const existingIds = new Set(state.chats.map((chat) => chat.id));
      const uniqueNewChats = safeNewChats.filter((chat) => !existingIds.has(chat.id));
      return { chats: [...state.chats, ...uniqueNewChats] };
    });
  },
  updateChat: (chatId, updates) =>
    set((state) => ({
      chats: state.chats.map((chat) => {
        if (chat.id !== chatId) return chat;
        if (updates.metadata && chat.metadata) return { ...chat, ...updates, metadata: { ...chat.metadata, ...updates.metadata } };
        return { ...chat, ...updates };
      }),
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
      return { typingIndicators: { ...state.typingIndicators, [chatId]: typingInfo } };
    }),
}));
