'use client';

import { create } from 'zustand';
import type { User } from '@chat-app/types';
import api from '../lib/api';

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  refreshTokenId: string;
  user: User;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isHydrated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string) => Promise<boolean>;
  refresh: () => Promise<boolean>;
  logout: () => void;
  bootstrap: () => void;
}

const ACCESS_TOKEN_KEY = 'chat.accessToken';
const REFRESH_TOKEN_KEY = 'chat.refreshToken';
const USER_KEY = 'chat.user';

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isHydrated: false,
  async login(username, password) {
    const response = await api.post<AuthResponse>('/auth/login', { username, password });
    const data = response.data;
    set({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken });
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
      window.localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
      window.localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    }
    return true;
  },
  async register(username, password) {
    const response = await api.post<AuthResponse>('/auth/register', { username, password });
    const data = response.data;
    set({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken });
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
      window.localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
      window.localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    }
    return true;
  },
  async refresh() {
    try {
      const refreshToken =
        get().refreshToken ??
        (typeof window !== 'undefined' ? window.localStorage.getItem(REFRESH_TOKEN_KEY) : null);
      if (!refreshToken) {
        return false;
      }
      const response = await api.post<AuthResponse>('/auth/refresh', { refreshToken });
      const data = response.data;
      set({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken });
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
        window.localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
        window.localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      }
      return true;
    } catch (error) {
      get().logout();
      return false;
    }
  },
  logout() {
    set({ user: null, accessToken: null, refreshToken: null });
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(ACCESS_TOKEN_KEY);
      window.localStorage.removeItem(REFRESH_TOKEN_KEY);
      window.localStorage.removeItem(USER_KEY);
    }
  },
  bootstrap() {
    if (typeof window === 'undefined') {
      return;
    }
    const storedAccess = window.localStorage.getItem(ACCESS_TOKEN_KEY);
    const storedRefresh = window.localStorage.getItem(REFRESH_TOKEN_KEY);
    const storedUserRaw = window.localStorage.getItem(USER_KEY);
    const storedUser = storedUserRaw ? (JSON.parse(storedUserRaw) as User) : null;
    set({
      accessToken: storedAccess,
      refreshToken: storedRefresh,
      user: storedUser,
      isHydrated: true
    });
  }
}));

export const getAuthStore = (): AuthState => useAuthStore.getState();
