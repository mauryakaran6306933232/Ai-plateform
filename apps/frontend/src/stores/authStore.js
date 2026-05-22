import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem('ai-platform-token') || null,
  isAuthenticated: !!localStorage.getItem('ai-platform-token'),

  setAuth: (user, token) => {
    localStorage.setItem('ai-platform-token', token);
    set({ user, token, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('ai-platform-token');
    set({ user: null, token: null, isAuthenticated: false });
  },
}));