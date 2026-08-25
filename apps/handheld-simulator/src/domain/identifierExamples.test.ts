import { describe, expect, it } from 'vitest';
import { IDENTIFIER_EXAMPLES } from './identifierExamples';
import {
  CONTAINER_IDENTIFIER_PATTERN,
  PACKAGE_IDENTIFIER_PATTERN,
  TRAILER_IDENTIFIER_PATTERN,
  TRUCK_UNIT_PATTERN,
} from './scanValidation';

describe('handheld identifier examples', () => {
  it('matches backend identifier rules and demo-seed conventions', () => {
    expect(IDENTIFIER_EXAMPLES.badgeBarcode).toMatch(/^BADGE\d{6}$/);
    expect(IDENTIFIER_EXAMPLES.employeeNumber).toMatch(/^EMP\d{5}$/);
    expect(IDENTIFIER_EXAMPLES.packageTrackingNumber).toMatch(PACKAGE_IDENTIFIER_PATTERN);
    expect(IDENTIFIER_EXAMPLES.containerBarcode).toMatch(CONTAINER_IDENTIFIER_PATTERN);
    expect(IDENTIFIER_EXAMPLES.trailerBarcode).toMatch(TRAILER_IDENTIFIER_PATTERN);
    expect(IDENTIFIER_EXAMPLES.routeCode).toMatch(/^R-[A-Z]{3}-[A-Z]{3}-\d{2}$/);
    expect(IDENTIFIER_EXAMPLES.truckUnitNumber).toMatch(TRUCK_UNIT_PATTERN);
  });
});
