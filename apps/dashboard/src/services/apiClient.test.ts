import axios, { type AxiosAdapter } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ACCESS_TOKEN_KEY, apiClient, REFRESH_TOKEN_KEY } from './apiClient';

describe('apiClient authentication recovery', () => {
  const originalAdapter = apiClient.defaults.adapter;

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('rotates tokens and retries the original request once after a 401', async () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'expired-access');
    localStorage.setItem(REFRESH_TOKEN_KEY, 'refresh-one');
    const refresh = vi.spyOn(axios, 'post').mockResolvedValue({
      data: { accessToken: 'fresh-access', refreshToken: 'refresh-two', tokenType: 'Bearer', expiresIn: 900 },
    });
    const authorizations: unknown[] = [];

    apiClient.defaults.adapter = (async config => {
      authorizations.push(config.headers.Authorization);
      if (authorizations.length === 1) {
        return Promise.reject({ config, response: { status: 401 }, isAxiosError: true });
      }
      return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config };
    }) as AxiosAdapter;

    const response = await apiClient.get<{ ok: boolean }>('/protected-resource');

    expect(response.data.ok).toBe(true);
    expect(refresh).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/auth/refresh',
      { refreshToken: 'refresh-one' },
      { timeout: 15_000 },
    );
    expect(authorizations).toEqual(['Bearer expired-access', 'Bearer fresh-access']);
    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBe('fresh-access');
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-two');
  });

  it('unwraps the platform success envelope for domain API services', async () => {
    apiClient.defaults.adapter = (async config => ({
      data: {
        success: true,
        data: { trackingNumber: 'CON1234567' },
        timestamp: '2026-07-24T12:00:00.000Z',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    })) as AxiosAdapter;

    const response = await apiClient.get<{ trackingNumber: string }>('/search');

    expect(response.data).toEqual({ trackingNumber: 'CON1234567' });
  });
});
