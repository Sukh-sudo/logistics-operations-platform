import { SetMetadata } from '@nestjs/common';

/**
 * Marks a route as intentionally available to every authenticated user.
 *
 * The global permission guard denies routes without an explicit policy. This
 * marker is therefore reserved for self-service and ownership-scoped APIs.
 */
export const ALLOW_AUTHENTICATED_KEY = 'authorization:allow-authenticated';

export const AllowAuthenticated = () =>
  SetMetadata(ALLOW_AUTHENTICATED_KEY, true);
