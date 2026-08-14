export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const JWT_ALGORITHM = 'HS256' as const;
export const JWT_ISSUER = process.env.JWT_ISSUER ?? 'logistics-operations-platform';
export const JWT_AUDIENCE = process.env.JWT_AUDIENCE ?? 'logistics-platform-clients';

function secret(name: 'JWT_ACCESS_SECRET') {
  const value = process.env[name]?.trim();
  if (!value || value.length < 32) {
    throw new Error(`${name} must be configured with at least 32 characters`);
  }
  return value;
}

export const accessTokenSecret = () => secret('JWT_ACCESS_SECRET');
