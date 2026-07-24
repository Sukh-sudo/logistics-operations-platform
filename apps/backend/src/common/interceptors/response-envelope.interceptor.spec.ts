import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { ResponseEnvelopeInterceptor } from './response-envelope.interceptor';

describe('ResponseEnvelopeInterceptor', () => {
  const context = (query: Record<string, unknown> = {}) => ({
    switchToHttp: () => ({
      getRequest: () => ({ query, requestId: 'request-1' }),
      getResponse: () => ({ statusCode: 200 }),
    }),
  } as unknown as ExecutionContext);

  it('wraps domain responses in the standard success contract', async () => {
    const interceptor = new ResponseEnvelopeInterceptor();
    const result = await firstValueFrom(interceptor.intercept(
      context(),
      { handle: () => of({ id: 'asset-1' }) } as CallHandler,
    ));

    expect(result).toEqual(expect.objectContaining({
      success: true,
      data: { id: 'asset-1' },
      timestamp: expect.any(String),
      requestId: 'request-1',
    }));
  });

  it('filters, sorts, and paginates list responses when requested', async () => {
    const interceptor = new ResponseEnvelopeInterceptor();
    const result = await firstValueFrom(interceptor.intercept(
      context({ status: 'ACTIVE', sort: '-name', page: '1', pageSize: '1' }),
      { handle: () => of([
        { name: 'Alpha', status: 'ACTIVE' },
        { name: 'Zulu', status: 'ACTIVE' },
        { name: 'Hidden', status: 'INACTIVE' },
      ]) } as CallHandler,
    )) as { data: unknown[]; pagination: unknown };

    expect(result.data).toEqual([{ name: 'Zulu', status: 'ACTIVE' }]);
    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 1,
      total: 2,
      totalPages: 2,
    });
  });
});
