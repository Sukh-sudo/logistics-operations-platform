import type {
  AuthTokens,
  Bootstrap,
  OperationalContext,
  OutboxEvent,
} from '../domain/types';

const KEYS = {
  installation: 'handheld.installation-id',
  tokens: 'handheld.tokens',
  bootstrap: 'handheld.bootstrap',
  outbox: 'handheld.outbox',
  context: 'handheld.context',
} as const;

function readJson<T>(key: string): T | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Corrupt simulator state should not prevent an operator from opening it.
    localStorage.removeItem(key);
    return null;
  }
}

export function installationId() {
  const existing = localStorage.getItem(KEYS.installation);
  if (existing) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem(KEYS.installation, created);
  return created;
}

export const tokenStorage = {
  get: () => readJson<AuthTokens>(KEYS.tokens),
  set: (tokens: AuthTokens) => localStorage.setItem(KEYS.tokens, JSON.stringify(tokens)),
  clear: () => localStorage.removeItem(KEYS.tokens),
};

export const bootstrapStorage = {
  get: () => readJson<Bootstrap>(KEYS.bootstrap),
  set: (bootstrap: Bootstrap) =>
    localStorage.setItem(KEYS.bootstrap, JSON.stringify(bootstrap)),
  clear: () => localStorage.removeItem(KEYS.bootstrap),
};

export const outboxStorage = {
  get: () => readJson<OutboxEvent[]>(KEYS.outbox) ?? [],
  set: (events: OutboxEvent[]) =>
    localStorage.setItem(KEYS.outbox, JSON.stringify(events)),
};

export const contextStorage = {
  get: () =>
    readJson<OperationalContext>(KEYS.context) ?? {
      trailerBarcode: '',
      routeCode: '',
      truckUnitNumber: '',
    },
  set: (context: OperationalContext) =>
    localStorage.setItem(KEYS.context, JSON.stringify(context)),
};

export function clearAuthentication() {
  tokenStorage.clear();
  bootstrapStorage.clear();
}
