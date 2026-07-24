import { Logger } from '@nestjs/common';

const logger = new Logger('LogisticsPlatform');

export interface ApplicationLogContext {
  requestId?: string | null;
  correlationId?: string | null;
  user?: string | null;
  [key: string]: unknown;
}

/** Emits application-owned logs with the fields required by operations. */
export function logApplicationEvent(
  level: 'log' | 'warn' | 'error' | 'debug',
  module: string,
  message: string,
  context: ApplicationLogContext = {},
) {
  logger[level](JSON.stringify({
    timestamp: new Date().toISOString(),
    requestId: context.requestId ?? null,
    correlationId: context.correlationId ?? context.requestId ?? null,
    user: context.user ?? null,
    module,
    message,
    ...context,
  }));
}
