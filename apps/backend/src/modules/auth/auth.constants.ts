export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function secret(name: 'JWT_ACCESS_SECRET') {
  const value = process.env[name];
  if (value) {
    return value;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${name} must be configured in production`);
  }
  return 'local-development-access-secret-change-me';
}

export const accessTokenSecret = () => secret('JWT_ACCESS_SECRET');
