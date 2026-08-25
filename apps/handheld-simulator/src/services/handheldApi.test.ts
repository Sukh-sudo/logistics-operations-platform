import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStorage } from '../storage/deviceStorage';
import { handheldApi } from './handheldApi';

describe('handheld API token refresh', () => {
  beforeEach(() => {
    tokenStorage.set({
      accessToken: 'expired-access',
      refreshToken: 'current-refresh',
      expiresIn: 900,
      tokenType: 'Bearer',
    });
  });

  it('rotates once when concurrent authorized requests receive 401 responses', async () => {
    let refreshCalls = 0;
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const authorization = new Headers(init?.headers).get('Authorization');

      if (url.endsWith('/auth/refresh')) {
        refreshCalls += 1;
        await Promise.resolve();
        return jsonResponse({
          accessToken: 'fresh-access',
          refreshToken: 'rotated-refresh',
          expiresIn: 900,
          tokenType: 'Bearer',
        });
      }
      if (authorization === 'Bearer expired-access') {
        return jsonResponse({ message: 'Invalid access token' }, 401);
      }
      return jsonResponse(url.endsWith('/bootstrap') ? { apiVersion: 'mobile-v1' } : {
        trackingNumber: 'CON0000100',
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const [bootstrap, lookup] = await Promise.all([
      handheldApi.bootstrap(),
      handheldApi.packageLookup('CON0000100'),
    ]);

    expect(refreshCalls).toBe(1);
    expect(bootstrap).toMatchObject({ apiVersion: 'mobile-v1' });
    expect(lookup).toMatchObject({ trackingNumber: 'CON0000100' });
    expect(tokenStorage.get()).toMatchObject({
      accessToken: 'fresh-access',
      refreshToken: 'rotated-refresh',
    });
  });

  it('uses tokens already rotated by another request after a late 401', async () => {
    let releaseLateRequest: (() => void) | undefined;
    const lateRequest = new Promise<void>((resolve) => {
      releaseLateRequest = resolve;
    });
    let expiredRequests = 0;
    let refreshCalls = 0;
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const authorization = new Headers(init?.headers).get('Authorization');

      if (url.endsWith('/auth/refresh')) {
        refreshCalls += 1;
        const response = jsonResponse({
          accessToken: 'fresh-access',
          refreshToken: 'rotated-refresh',
          expiresIn: 900,
          tokenType: 'Bearer',
        });
        releaseLateRequest?.();
        return response;
      }
      if (authorization === 'Bearer expired-access') {
        expiredRequests += 1;
        if (expiredRequests === 2) await lateRequest;
        return jsonResponse({ message: 'Invalid access token' }, 401);
      }
      return jsonResponse(url.endsWith('/bootstrap') ? { apiVersion: 'mobile-v1' } : {
        trackingNumber: 'CON0000100',
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    await Promise.all([
      handheldApi.bootstrap(),
      handheldApi.packageLookup('CON0000100'),
    ]);

    expect(refreshCalls).toBe(1);
  });

  it('uses the rotated refresh token when retrying logout', async () => {
    const logoutBodies: string[] = [];
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const authorization = new Headers(init?.headers).get('Authorization');

      if (url.endsWith('/auth/refresh')) {
        return jsonResponse({
          accessToken: 'fresh-access',
          refreshToken: 'rotated-refresh',
          expiresIn: 900,
          tokenType: 'Bearer',
        });
      }
      if (url.endsWith('/auth/logout')) {
        logoutBodies.push(String(init?.body));
        if (authorization === 'Bearer expired-access') {
          return jsonResponse({ message: 'Invalid access token' }, 401);
        }
        return jsonResponse({ loggedOut: true });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    await handheldApi.logout();

    expect(logoutBodies.map((body) => JSON.parse(body))).toEqual([
      { refreshToken: 'current-refresh' },
      { refreshToken: 'rotated-refresh' },
    ]);
  });

  it('clears stale authentication when refresh is rejected', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) =>
      String(input).endsWith('/auth/refresh')
        ? jsonResponse({ message: 'Invalid refresh token' }, 401)
        : jsonResponse({ message: 'Invalid access token' }, 401),
    ));

    await expect(handheldApi.bootstrap()).rejects.toThrow(
      'Your session expired. Sign in again.',
    );
    expect(tokenStorage.get()).toBeNull();
  });
});

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(status < 400 ? { success: true, data } : data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
