// Tests use an explicit non-production key; application code has no fallback.
process.env.JWT_ACCESS_SECRET =
  'backend-test-jwt-secret-at-least-thirty-two-characters';
process.env.JWT_ISSUER = 'logistics-operations-platform';
process.env.JWT_AUDIENCE = 'logistics-platform-clients';
