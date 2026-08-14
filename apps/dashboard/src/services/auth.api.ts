import type { AuthUserDto, LoginRequestDto, LoginResponseDto } from '@logistics/shared-types';
import { apiClient, clearSession, refreshAccessToken, setAccessToken } from './apiClient';

type AccessResponse = Omit<LoginResponseDto, 'refreshToken'>;

export const authApi = {
  async login(credentials: LoginRequestDto) {
    const { data } = await apiClient.post<AccessResponse>('/auth/web/login', credentials, {
      headers: { 'x-csrf-protection': '1' },
    });
    setAccessToken(data.accessToken);
    return data;
  },
  async restoreSession() {
    await refreshAccessToken();
  },
  async me() {
    return (await apiClient.get<AuthUserDto>('/auth/me')).data;
  },
  async logout() {
    await apiClient.post('/auth/web/logout', {}, {
      headers: { 'x-csrf-protection': '1' },
    }).catch(() => undefined);
    clearSession();
  },
};
