import axios, { type InternalAxiosRequestConfig } from 'axios';
import type { ApiSuccessResponseDto, LoginResponseDto } from '@logistics/shared-types';

export const ACCESS_TOKEN_KEY = 'logistics_access_token';
export const REFRESH_TOKEN_KEY = 'logistics_refresh_token';

// The dashboard targets the canonical API version by default. Deployments can
// still override the complete API base URL through the Vite environment.
const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';

export const apiClient = axios.create({
  baseURL,
  timeout: 15_000,
});

interface RetryableRequest extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

let refreshPromise: Promise<string> | null = null;

function clearSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) throw new Error('No refresh token is available');

  // Use an interceptor-free request because refresh failures must not recurse.
  const response = await axios.post<ApiSuccessResponseDto<LoginResponseDto> | LoginResponseDto>(`${baseURL}/auth/refresh`, { refreshToken }, { timeout: 15_000 });
  const data = 'success' in response.data ? response.data.data : response.data;
  localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
  return data.accessToken;
}

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use((response) => {
  const body = response.data as ApiSuccessResponseDto<unknown> | unknown;
  if (body && typeof body === 'object' && 'success' in body && body.success === true && 'data' in body) {
    // Keep existing service consumers focused on domain DTOs while the HTTP
    // boundary exposes the standard envelope to non-dashboard clients.
    response.data = body.data;
  }
  return response;
}, async (error) => {
  const request = error.config as RetryableRequest | undefined;
  const isAuthenticationRequest = request?.url?.includes('/auth/login') || request?.url?.includes('/auth/refresh');

  if (error.response?.status === 401 && request && !request._retry && !isAuthenticationRequest) {
    request._retry = true;
    try {
      // Concurrent 401 responses share one rotating refresh-token request.
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
      const accessToken = await refreshPromise;
      request.headers.Authorization = `Bearer ${accessToken}`;
      return apiClient(request);
    } catch {
      clearSession();
      if (window.location.pathname !== '/login') window.location.assign('/login');
    }
  }

  if (error.response?.status === 401 && isAuthenticationRequest) clearSession();
  return Promise.reject(error);
});
