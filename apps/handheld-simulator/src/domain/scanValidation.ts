import type { ActionDefinition } from './workflows';

// Keep these aligned with the operational identifier rules enforced by the API.
export const PACKAGE_IDENTIFIER_PATTERN = /^(MAIL\d{6}|CON\d{7}|NCON\d{6}|DG\d{8})$/;
export const CONTAINER_IDENTIFIER_PATTERN = PACKAGE_IDENTIFIER_PATTERN;
export const TRAILER_IDENTIFIER_PATTERN = /^TRLR\d{6}$/;
export const TRUCK_UNIT_PATTERN = /^(LM|MM)[A-Z]{3}\d{5}$/;

export type ScanField =
  | 'identifier'
  | 'containerBarcode'
  | 'trailerBarcode'
  | 'truckUnitNumber';

export type ScanValidationErrors = Partial<Record<ScanField, string>>;

interface ScanValidationInput {
  definition: ActionDefinition;
  identifier: string;
  containerBarcode: string;
  trailerBarcode: string;
  truckUnitNumber: string;
}

export function validateScanInput({
  definition,
  identifier,
  containerBarcode,
  trailerBarcode,
  truckUnitNumber,
}: ScanValidationInput): ScanValidationErrors {
  const errors: ScanValidationErrors = {};
  const normalizedIdentifier = identifier.trim().toUpperCase();

  if (
    definition.identifier === 'PACKAGE' &&
    normalizedIdentifier &&
    !PACKAGE_IDENTIFIER_PATTERN.test(normalizedIdentifier)
  ) {
    errors.identifier =
      'Package tracking number must use MAIL + 6 digits, CON + 7 digits, NCON + 6 digits, or DG + 8 digits.';
  }

  if (
    definition.identifier === 'CONTAINER' &&
    normalizedIdentifier &&
    !CONTAINER_IDENTIFIER_PATTERN.test(normalizedIdentifier)
  ) {
    errors.identifier =
      'Container barcode must use MAIL + 6 digits, CON + 7 digits, NCON + 6 digits, or DG + 8 digits.';
  }

  if (
    definition.needsContainer &&
    definition.identifier === 'PACKAGE' &&
    containerBarcode.trim() &&
    !CONTAINER_IDENTIFIER_PATTERN.test(containerBarcode.trim().toUpperCase())
  ) {
    errors.containerBarcode =
      'Container barcode must use MAIL + 6 digits, CON + 7 digits, NCON + 6 digits, or DG + 8 digits.';
  }

  if (
    definition.needsTrailer &&
    trailerBarcode.trim() &&
    !TRAILER_IDENTIFIER_PATTERN.test(trailerBarcode.trim().toUpperCase())
  ) {
    errors.trailerBarcode =
      'Trailer barcode must use TRLR followed by exactly 6 digits.';
  }

  if (
    definition.needsRoute &&
    truckUnitNumber.trim() &&
    !TRUCK_UNIT_PATTERN.test(truckUnitNumber.trim().toUpperCase())
  ) {
    errors.truckUnitNumber =
      'Truck unit must use LM or MM, a 3-letter terminal code, and 5 digits (for example LMYYC00001).';
  }

  return errors;
}
