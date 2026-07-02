import axios from 'axios';

export const ACCESS_TOKEN_KEY = 'logistics_access_token';
export const REFRESH_TOKEN_KEY = 'logistics_refresh_token';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000',
  timeout: 15_000,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(undefined, (error) => {
  if (error.response?.status === 401 && window.location.pathname !== '/login') {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    window.location.assign('/login');
  }
  return Promise.reject(error);
});
