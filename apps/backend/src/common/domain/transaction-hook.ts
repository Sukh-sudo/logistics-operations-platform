import type { Prisma } from '@prisma/client';

/**
 * Lets an orchestrator append its own records inside an aggregate service's
 * transaction without moving or duplicating aggregate business rules.
 */
export type TransactionHook<T = unknown> = (
  tx: Prisma.TransactionClient,
  domainEventId?: string,
) => Promise<T>;
