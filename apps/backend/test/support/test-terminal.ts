import type {
  ArgumentMetadata,
  INestApplication,
  PipeTransform,
} from '@nestjs/common';
import request from 'supertest';

let sequence = 0;

/** Creates a real terminal aggregate/event/snapshot fixture through the API. */
export async function createTestTerminal(
  app: INestApplication,
  prefix = 'TST',
) {
  const suffix = `${Date.now().toString(36)}${sequence++}`.toUpperCase();
  const response = await request(app.getHttpServer())
    .post('/terminals')
    .send({
      terminalCode: `${prefix}${suffix}`,
      city: 'Calgary',
      province: 'Alberta',
      country: 'Canada',
      timezone: 'America/Edmonton',
    })
    .expect(201);
  return response.body.terminal.id as number;
}

/**
 * Keeps legacy operational fixtures concise while still sending the required
 * terminal ownership field through DTO validation and production services.
 */
export class TestTerminalDefaultsPipe implements PipeTransform {
  constructor(private readonly terminalId: () => number | undefined) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    if (!value || typeof value !== 'object' || metadata.type !== 'body') {
      return value;
    }
    const dtoName = metadata.metatype?.name;
    const body = value as Record<string, unknown>;
    const needsTerminal =
      dtoName === 'CreateContainerDto' ||
      dtoName === 'CreateTrailerDto' ||
      (dtoName === 'CreatePackageEventDto' &&
        body.eventType === 'PACKAGE_RECEIVED');
    const terminalId = this.terminalId();
    if (needsTerminal && body.terminalId === undefined && terminalId !== undefined) {
      return { ...body, terminalId };
    }
    return value;
  }
}
