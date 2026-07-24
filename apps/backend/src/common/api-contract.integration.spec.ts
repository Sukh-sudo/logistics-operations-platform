import {
  BadRequestException,
  Controller,
  Get,
  type INestApplication,
  Module,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApplication } from '../configure-application';

@Controller('contract-probe')
class ContractProbeController {
  @Get()
  list() {
    return [
      { id: 1, status: 'ACTIVE' },
      { id: 2, status: 'INACTIVE' },
    ];
  }

  @Get('error')
  error() {
    throw new BadRequestException('Probe rejected');
  }
}

@Module({ controllers: [ContractProbeController] })
class ContractProbeModule {}

describe('HTTP API contract integration', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      imports: [ContractProbeModule],
    }).compile();
    app = fixture.createNestApplication();
    configureApplication(app);
    await app.init();
  });

  afterAll(() => app.close());

  it.each(['/contract-probe', '/api/v1/contract-probe'])(
    'serves success envelopes on %s',
    async path => {
      const response = await request(app.getHttpServer())
        .get(path)
        .query({ status: 'ACTIVE', page: 1, pageSize: 10 })
        .expect(200);

      expect(response.body).toEqual(expect.objectContaining({
        success: true,
        data: [{ id: 1, status: 'ACTIVE' }],
        pagination: {
          page: 1,
          pageSize: 10,
          total: 1,
          totalPages: 1,
        },
        timestamp: expect.any(String),
      }));
    },
  );

  it('serves the standard error envelope', async () => {
    const response = await request(app.getHttpServer())
      .get('/contract-probe/error')
      .expect(400);

    expect(response.body).toEqual(expect.objectContaining({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Probe rejected',
      },
      path: '/contract-probe/error',
      timestamp: expect.any(String),
    }));
  });
});
