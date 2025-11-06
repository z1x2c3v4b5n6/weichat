import axios, { AxiosRequestConfig } from 'axios';
import { getAuthStore } from '../store/useAuthStore';

interface RetryableRequestConfig extends AxiosRequestConfig {
  _retry?: boolean;
}

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001',
  withCredentials: false
});

api.interceptors.request.use((config) => {
  const token = getAuthStore().accessToken;
  if (token) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`
    };
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as RetryableRequestConfig;
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      const store = getAuthStore();
      if (store.refreshToken) {
        const refreshed = await store.refresh();
        if (refreshed && original.headers) {
          original.headers.Authorization = `Bearer ${store.accessToken}`;
          return api(original);
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
