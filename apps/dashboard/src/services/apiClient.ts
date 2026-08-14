import axios, { type InternalAxiosRequestConfig } from 'axios';
import type { ApiSuccessResponseDto, LoginResponseDto } from '@logistics/shared-types';

type AccessResponse = Omit<LoginResponseDto, 'refreshToken'>;
let accessToken: string | null = null;

export function setAccessToken(token: string) {
  accessToken = token;
}

export function clearSession() {
  accessToken = null;
}

// Remove sessions created by older dashboard releases. New tokens are never
// written to Web Storage, but a deployment must also retire existing values.
try {
  localStorage.removeItem('logistics_access_token');
  localStorage.removeItem('logistics_refresh_token');
} catch {
  // Storage can be unavailable under restrictive browser privacy policies.
}

// The dashboard targets the canonical API version by default. Deployments can
// still override the complete API base URL through the Vite environment.
const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';

export const apiClient = axios.create({
  baseURL,
  timeout: 15_000,
  withCredentials: true,
});

interface RetryableRequest extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

let refreshPromise: Promise<string> | null = null;

export async function refreshAccessToken() {
  // Use an interceptor-free request because refresh failures must not recurse.
  const response = await axios.post<ApiSuccessResponseDto<AccessResponse> | AccessResponse>(
    `${baseURL}/auth/web/refresh`,
    {},
    {
      timeout: 15_000,
      withCredentials: true,
      headers: { 'x-csrf-protection': '1' },
    },
  );
  const data = 'success' in response.data ? response.data.data : response.data;
  setAccessToken(data.accessToken);
  return data.accessToken;
}

apiClient.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
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
  const isAuthenticationRequest = request?.url?.includes('/auth/web/login') || request?.url?.includes('/auth/web/refresh');

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
