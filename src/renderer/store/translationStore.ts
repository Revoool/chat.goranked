import { create } from 'zustand';

export type ChatTranslateViewMode = 'original' | 'uk';

const cacheKey = (chatId: number, messageId: number) => `${chatId}:${messageId}`;

interface TranslationState {
  translations: Record<string, string>;
  viewModeByChatId: Record<number, ChatTranslateViewMode>;
  mergeTranslations: (chatId: number, map: Record<number, string>) => void;
  setViewMode: (chatId: number, mode: ChatTranslateViewMode) => void;
  getTranslation: (chatId: number, messageId: number) => string | undefined;
  getViewMode: (chatId: number) => ChatTranslateViewMode;
  chatHasAnyTranslation: (chatId: number) => boolean;
}

export const useTranslationStore = create<TranslationState>((set, get) => ({
  translations: {},
  viewModeByChatId: {},

  mergeTranslations: (chatId, map) =>
    set((s) => {
      const next = { ...s.translations };
      for (const [id, text] of Object.entries(map)) {
        next[cacheKey(chatId, Number(id))] = text;
      }
      return { translations: next };
    }),

  setViewMode: (chatId, mode) =>
    set((s) => ({
      viewModeByChatId: { ...s.viewModeByChatId, [chatId]: mode },
    })),

  getTranslation: (chatId, messageId) => get().translations[cacheKey(chatId, messageId)],

  getViewMode: (chatId) => get().viewModeByChatId[chatId] ?? 'original',

  chatHasAnyTranslation: (chatId) => {
    const prefix = `${chatId}:`;
    return Object.keys(get().translations).some((k) => k.startsWith(prefix));
  },
}));
