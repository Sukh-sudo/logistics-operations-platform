let sequence = 0;

function digits(length: number): string {
  sequence += 1;
  return `${Date.now()}${sequence}`.slice(-length).padStart(length, '0');
}

export const packageIdentifier = (prefix: 'MAIL' | 'CON' | 'NCON' | 'DG' = 'CON') =>
  `${prefix}${digits(10 - prefix.length)}`;

export const containerIdentifier = packageIdentifier;

export const trailerIdentifier = () => `TRLR${digits(6)}`;
