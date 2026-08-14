import { accessTokenSecret } from '../auth.constants';

describe('JWT configuration', () => {
  const configured = process.env.JWT_ACCESS_SECRET;

  afterEach(() => {
    process.env.JWT_ACCESS_SECRET = configured;
  });

  it('has no known fallback when the signing secret is missing', () => {
    delete process.env.JWT_ACCESS_SECRET;
    expect(() => accessTokenSecret()).toThrow(
      'JWT_ACCESS_SECRET must be configured with at least 32 characters',
    );
  });

  it('rejects an undersized signing secret in every environment', () => {
    process.env.JWT_ACCESS_SECRET = 'too-short';
    expect(() => accessTokenSecret()).toThrow(
      'JWT_ACCESS_SECRET must be configured with at least 32 characters',
    );
  });
});
