import { describe, expect, it } from 'vitest';
import { validateScanInput } from './scanValidation';
import { taskDefinition } from './workflows';

describe('handheld scan validation', () => {
  it('rejects a malformed package scan before capture', () => {
    const definition = taskDefinition('TRAILER_LOAD').actions[0];

    expect(validateScanInput({
      definition,
      identifier: 'CON12345',
      containerBarcode: '',
      trailerBarcode: 'TRLR123456',
      truckUnitNumber: '',
    })).toEqual({
      identifier: expect.stringContaining('CON + 7 digits'),
    });
  });

  it('validates container, trailer, and truck values in their assigned fields', () => {
    const containerDefinition = taskDefinition('CONTAINER_LOAD').actions[0];
    const routeDefinition = taskDefinition('LAST_MILE_LOADING').actions[0];

    expect(validateScanInput({
      definition: containerDefinition,
      identifier: 'MAIL123456',
      containerBarcode: 'TRLR123456',
      trailerBarcode: '',
      truckUnitNumber: '',
    })).toHaveProperty('containerBarcode');

    expect(validateScanInput({
      definition: routeDefinition,
      identifier: 'CON1234567',
      containerBarcode: '',
      trailerBarcode: '',
      truckUnitNumber: 'TRLR123456',
    })).toHaveProperty('truckUnitNumber');
  });

  it('accepts platform identifier formats', () => {
    const definition = taskDefinition('TRAILER_LOAD').actions[0];

    expect(validateScanInput({
      definition,
      identifier: 'DG12345678',
      containerBarcode: '',
      trailerBarcode: 'TRLR123456',
      truckUnitNumber: '',
    })).toEqual({});
  });
});
