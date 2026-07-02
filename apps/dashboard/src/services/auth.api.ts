import type { AuthUserDto, LoginRequestDto, LoginResponseDto } from '@logistics/shared-types';
import { ACCESS_TOKEN_KEY, apiClient, REFRESH_TOKEN_KEY } from './apiClient';

export const authApi = {
  async login(credentials: LoginRequestDto) {
    const { data } = await apiClient.post<LoginResponseDto>('/auth/login', credentials);
    localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
    return data;
  },
  async me() { return (await apiClient.get<AuthUserDto>('/auth/me')).data; },
  async logout() {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (refreshToken) await apiClient.post('/auth/logout', { refreshToken }).catch(() => undefined);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};
