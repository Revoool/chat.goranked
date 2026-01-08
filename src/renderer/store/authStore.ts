import { create } from 'zustand';
import { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setIsLoading: (isLoading: boolean) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setToken: (token) => set({ token }),
  setIsLoading: (isLoading) => set({ isLoading }),
  logout: async () => {
    if (window.electronAPI) {
      await window.electronAPI.deleteToken();
    } else {
      localStorage.removeItem('token');
    }
    // Clear user data and permissions from localStorage
    localStorage.removeItem('userData');
    localStorage.removeItem('userAbilityPages');
    localStorage.removeItem('userAbilityRules');
    set({ user: null, token: null, isAuthenticated: false });
  },
}));

