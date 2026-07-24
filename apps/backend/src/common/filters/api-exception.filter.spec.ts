import { BadRequestException, type ArgumentsHost } from '@nestjs/common';
import { ApiExceptionFilter } from './api-exception.filter';

describe('ApiExceptionFilter', () => {
  it('normalizes validation failures without exposing implementation details', () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({
          requestId: 'request-1',
          correlationId: 'correlation-1',
          originalUrl: '/users',
        }),
        getResponse: () => ({ status }),
      }),
    } as unknown as ArgumentsHost;
    const filter = new ApiExceptionFilter();

    filter.catch(new BadRequestException({
      message: ['email must be an email'],
      error: 'Bad Request',
      statusCode: 400,
    }), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed.',
        details: ['email must be an email'],
      },
      timestamp: expect.any(String),
      path: '/users',
      requestId: 'request-1',
    });
  });
});
