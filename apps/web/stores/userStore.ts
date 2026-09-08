import { create } from 'zustand';
import { User } from '@/types';
import { api } from '@/lib/api';
import { AuthResponse } from '@/types';

interface UserState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  fetchUser: () => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<void>;
  setUser: (user: User) => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  isLoading: false,
  error: null,

  fetchUser: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<AuthResponse>('/auth/me');
      set({ user: response.data.user, isLoading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch user';
      set({ error: message, isLoading: false });
    }
  },

  updateUser: async (userData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.patch<AuthResponse>('/auth/me', userData);
      set({ user: response.data.user, isLoading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update user';
      set({ error: message, isLoading: false });
    }
  },

  setUser: (user) => set({ user }),
}));
