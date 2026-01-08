import { create } from 'zustand';
import { Chat, ChatFilters } from '../types';

export type MenuItem = 'inbox' | 'assigned' | 'closed' | 'settings' | 'tasks' | 'order-chats' | 'product-chats';

interface TypingInfo {
  isTyping: boolean;
  userId: number | null;
  userName: string | null;
}

interface ChatState {
  selectedChatId: number | null;
  selectedOrderChatId: number | null; // ID заказа для order chats
  selectedProductChatId: string | number | null; // ID чата по вопросам к товарам (формат "productId_buyerId" или число)
  filters: ChatFilters;
  chats: Chat[];
  activeMenu: MenuItem;
  isClientCardOpen: boolean;
  typingIndicators: Record<number, TypingInfo>; // chatId -> typing info
  searchQuery: string; // Текущий поисковый запрос для подсветки
  setSelectedChat: (chatId: number | null) => void;
  setSelectedOrderChat: (orderId: number | null) => void; // Выбрать чат заказа
  setSelectedProductChat: (orderId: number | null) => void; // Выбрать чат заказа маркетплейса
  setFilters: (filters: Partial<ChatFilters>) => void;
  setChats: (chats: Chat[]) => void;
  appendChats: (chats: Chat[]) => void; // Добавить чаты к существующим (для пагинации)
  updateChat: (chatId: number, updates: Partial<Chat>) => void;
  addChat: (chat: Chat) => void;
  setActiveMenu: (menu: MenuItem) => void;
  toggleClientCard: () => void;
  setClientCardOpen: (isOpen: boolean) => void;
  setTypingIndicator: (chatId: number, typingInfo: TypingInfo | null) => void;
  setSearchQuery: (query: string) => void;
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
  setSelectedChat: (chatId) => set({ selectedChatId: chatId, selectedOrderChatId: null, selectedProductChatId: null, isClientCardOpen: false }), // Close card when switching chats
  setSelectedOrderChat: (orderId) => set({ selectedOrderChatId: orderId, selectedChatId: null, selectedProductChatId: null, isClientCardOpen: false }), // Close card when switching order chats
  setSelectedProductChat: (chatId) => set({ selectedProductChatId: chatId, selectedChatId: null, selectedOrderChatId: null, isClientCardOpen: false }), // Close card when switching product inquiry chats
  setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setChats: (chats) => {
    // Ensure chats is always an array
    const safeChats = Array.isArray(chats) ? chats : [];
    console.log('💾 Setting chats in store:', safeChats.length, 'chats');
    console.log('💾 Chats data:', safeChats);
    set({ chats: safeChats });
  },
  appendChats: (newChats) => {
    // Добавляем новые чаты к существующим, избегая дубликатов
    const safeNewChats = Array.isArray(newChats) ? newChats : [];
    set((state) => {
      const existingIds = new Set(state.chats.map((chat) => chat.id));
      const uniqueNewChats = safeNewChats.filter((chat) => !existingIds.has(chat.id));
      const allChats = [...state.chats, ...uniqueNewChats];
      console.log('💾 Appending chats to store:', uniqueNewChats.length, 'new chats, total:', allChats.length);
      return { chats: allChats };
    });
  },
  updateChat: (chatId, updates) =>
    set((state) => ({
      chats: state.chats.map((chat) => {
        if (chat.id === chatId) {
          // Deep merge for metadata to preserve existing fields
          if (updates.metadata && chat.metadata) {
            return { ...chat, ...updates, metadata: { ...chat.metadata, ...updates.metadata } };
          }
          return { ...chat, ...updates };
        }
        return chat;
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
      return {
        typingIndicators: {
          ...state.typingIndicators,
          [chatId]: typingInfo,
        },
      };
    }),
}));

