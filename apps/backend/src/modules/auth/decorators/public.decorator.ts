import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Authentication is required globally. This decorator is reserved for the
 * small set of endpoints that are intentionally available without a session.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
