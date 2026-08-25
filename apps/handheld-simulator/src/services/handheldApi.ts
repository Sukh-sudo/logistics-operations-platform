import type {
  AuthTokens,
  Bootstrap,
  LoginResponse,
  PackageLookup,
  ScanCommand,
  ScanResult,
  TaskType,
  WorkSession,
} from '../domain/types';
import { clearAuthentication, tokenStorage } from '../storage/deviceStorage';

interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

interface ErrorEnvelope {
  success?: false;
  error?: { code?: string; message?: string; details?: string[] };
  message?: string | string[];
}

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api/mobile/v1';
let refreshInFlight: Promise<AuthTokens> | null = null;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

async function decode<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as
    | SuccessEnvelope<T>
    | ErrorEnvelope
    | T;
  if (!response.ok) {
    const error = body as ErrorEnvelope;
    const rawMessage = error.error?.message ?? error.message ?? response.statusText;
    const message = Array.isArray(rawMessage) ? rawMessage.join(', ') : rawMessage;
    throw new ApiError(message || 'The handheld request failed.', response.status, error.error?.code);
  }
  return typeof body === 'object' && body !== null && 'success' in body
    ? (body as SuccessEnvelope<T>).data
    : (body as T);
}

async function rawRequest<T>(
  path: string,
  init: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      ...init.headers,
    },
  });
  return decode<T>(response);
}

type AuthorizedInit = RequestInit | ((tokens: AuthTokens) => RequestInit);

async function authorized<T>(path: string, init: AuthorizedInit = {}): Promise<T> {
  const requestTokens = tokenStorage.get();
  if (!requestTokens) throw new ApiError('Sign in is required.', 401);
  try {
    return await rawRequest<T>(path, resolveInit(init, requestTokens), requestTokens.accessToken);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401 || path === '/auth/refresh') {
      throw error;
    }

    const currentTokens = tokenStorage.get();
    if (!currentTokens) throw new ApiError('Sign in is required.', 401);

    // Another request may already have rotated the one-use refresh token while
    // this request was in flight. Retry with its new access token instead of
    // replaying the old refresh token and invalidating the token family.
    const tokens = currentTokens.refreshToken !== requestTokens.refreshToken
      ? currentTokens
      : await refreshTokens(currentTokens.refreshToken);
    return rawRequest<T>(path, resolveInit(init, tokens), tokens.accessToken);
  }
}

function resolveInit(init: AuthorizedInit, tokens: AuthTokens) {
  return typeof init === 'function' ? init(tokens) : init;
}

function refreshTokens(refreshToken: string): Promise<AuthTokens> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = rawRequest<AuthTokens>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  })
    .then((tokens) => {
      tokenStorage.set(tokens);
      return tokens;
    })
    .catch((error) => {
      if (error instanceof ApiError && error.status === 401) {
        clearAuthentication();
        throw new ApiError('Your session expired. Sign in again.', 401, error.code);
      }
      throw error;
    })
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

export const handheldApi = {
  login: (
    badgeBarcode: string,
    employeeId: string,
    deviceId: string,
    deviceCredential: string,
  ) =>
    rawRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ badgeBarcode, employeeId, deviceId, deviceCredential }),
    }),
  bootstrap: () => authorized<Bootstrap>('/bootstrap'),
  logout: () =>
    authorized<{ loggedOut: true }>('/auth/logout', (tokens) => ({
      method: 'POST',
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    })),
  startSession: (taskType: TaskType, deviceId: string, online: boolean) =>
    authorized<{ session: WorkSession; snapshot: WorkSession['snapshot'] }>(
      '/work-sessions',
      {
        method: 'POST',
        body: JSON.stringify({
          taskType,
          deviceId,
          networkState: online ? 'ONLINE' : 'OFFLINE_NETWORK',
        }),
      },
    ),
  transitionSession: (
    sessionId: string,
    transition: 'pause' | 'resume' | 'complete',
  ) =>
    authorized<{ snapshot: WorkSession['snapshot'] }>(
      `/work-sessions/${encodeURIComponent(sessionId)}/${transition}`,
      { method: 'POST' },
    ),
  scan: (command: ScanCommand) =>
    authorized<ScanResult>('/scans', {
      method: 'POST',
      body: JSON.stringify(command),
    }),
  sync: (taskSessionId: string, events: ScanCommand[]) =>
    authorized<{ batchId: string; results: ScanResult[] }>('/sync', {
      method: 'POST',
      body: JSON.stringify({
        taskSessionId,
        batchId: crypto.randomUUID(),
        events,
      }),
    }),
  reverse: (receiptId: string, command: ScanCommand) =>
    authorized<ScanResult>(`/events/${encodeURIComponent(receiptId)}/reverse`, {
      method: 'POST',
      body: JSON.stringify(command),
    }),
  packageLookup: (trackingNumber: string) =>
    authorized<PackageLookup>(`/packages/${encodeURIComponent(trackingNumber)}`),
};
