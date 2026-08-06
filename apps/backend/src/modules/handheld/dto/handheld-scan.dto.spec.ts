import { HandheldAction, HandheldNetworkState } from '@prisma/client';
import { validate } from 'class-validator';
import { HandheldScanDto } from './handheld-scan.dto';

describe('HandheldScanDto identifier validation', () => {
  it('rejects malformed operational identifiers before session processing', async () => {
    const dto = scanDto();
    dto.trackingNumber = 'CON12345';
    dto.trailerBarcode = 'TRLR123';

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['trackingNumber', 'trailerBarcode']),
    );
  });

  it('accepts valid package and trailer identifiers', async () => {
    const errors = await validate(scanDto());

    expect(errors).toEqual([]);
  });
});

function scanDto() {
  return Object.assign(new HandheldScanDto(), {
    taskSessionId: 'session-1',
    clientEventId: 'f0533e46-9466-45a6-9638-188b13ce8efe',
    action: HandheldAction.LOAD_PACKAGE_TO_TRAILER,
    deviceId: '8c808770-d3c8-4891-8382-f700e919aec3',
    deviceTimestamp: '2026-07-28T12:00:00.000Z',
    networkStateAtCapture: HandheldNetworkState.ONLINE,
    trackingNumber: 'CON1234567',
    trailerBarcode: 'TRLR123456',
  });
}
