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
import { tokenStorage } from '../storage/deviceStorage';

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

async function authorized<T>(path: string, init: RequestInit = {}): Promise<T> {
  let tokens = tokenStorage.get();
  if (!tokens) throw new ApiError('Sign in is required.', 401);
  try {
    return await rawRequest<T>(path, init, tokens.accessToken);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401 || path === '/auth/refresh') {
      throw error;
    }
    // Refresh rotation happens once, then the original idempotent request is retried.
    tokens = await rawRequest<AuthTokens>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });
    tokenStorage.set(tokens);
    return rawRequest<T>(path, init, tokens.accessToken);
  }
}

export const handheldApi = {
  login: (badgeBarcode: string, employeeId: string, deviceId: string) =>
    rawRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ badgeBarcode, employeeId, deviceId }),
    }),
  bootstrap: () => authorized<Bootstrap>('/bootstrap'),
  logout: (refreshToken: string) =>
    authorized<{ loggedOut: true }>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),
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
