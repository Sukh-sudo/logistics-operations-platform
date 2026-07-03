import { PackageType } from '@prisma/client';
import {
  CONTAINER_IDENTIFIER_PATTERN,
  PACKAGE_IDENTIFIER_PATTERN,
  TRAILER_IDENTIFIER_PATTERN,
  packageTypeFromIdentifier,
} from './asset-identifiers';

describe('asset identifiers', () => {
  it.each([
    ['MAIL123456', PackageType.MAIL],
    ['CON1234567', PackageType.CONVEYABLE],
    ['NCON123456', PackageType.NON_CONVEYABLE],
    ['DG12345678', PackageType.DANGEROUS_GOODS],
  ])('accepts %s and derives its package type', (identifier, expectedType) => {
    expect(PACKAGE_IDENTIFIER_PATTERN.test(identifier)).toBe(true);
    expect(CONTAINER_IDENTIFIER_PATTERN.test(identifier)).toBe(true);
    expect(packageTypeFromIdentifier(identifier)).toBe(expectedType);
  });

  it.each(['mail123456', 'CON123456', 'NCON1234567', 'DG1234567', 'PKG1234567'])
  ('rejects invalid package and container identifier %s', (identifier) => {
    expect(PACKAGE_IDENTIFIER_PATTERN.test(identifier)).toBe(false);
  });

  it('accepts only TRLR followed by six digits for trailers', () => {
    expect(TRAILER_IDENTIFIER_PATTERN.test('TRLR123456')).toBe(true);
    expect(TRAILER_IDENTIFIER_PATTERN.test('TRL1234567')).toBe(false);
    expect(TRAILER_IDENTIFIER_PATTERN.test('trlr123456')).toBe(false);
  });
});
