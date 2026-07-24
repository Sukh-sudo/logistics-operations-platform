import type { NextFunction, Response } from 'express';
import { RequestIdMiddleware, type RequestWithId } from './request-id.middleware';

describe('RequestIdMiddleware', () => {
  it('generates a request ID and preserves a safe incoming correlation ID', () => {
    const request = {
      header: jest.fn().mockReturnValue('shipment-workflow-42'),
    } as unknown as RequestWithId;
    const response = {
      setHeader: jest.fn(),
    } as unknown as Response;
    const next = jest.fn() as NextFunction;

    new RequestIdMiddleware().use(request, response, next);

    expect(request.requestId).toEqual(expect.any(String));
    expect(request.correlationId).toBe('shipment-workflow-42');
    expect(response.setHeader).toHaveBeenCalledWith('x-request-id', request.requestId);
    expect(response.setHeader).toHaveBeenCalledWith('x-correlation-id', 'shipment-workflow-42');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('uses the request ID when an incoming correlation ID is too long', () => {
    const request = {
      header: jest.fn().mockReturnValue('x'.repeat(129)),
    } as unknown as RequestWithId;
    const response = {
      setHeader: jest.fn(),
    } as unknown as Response;

    new RequestIdMiddleware().use(request, response, jest.fn());

    expect(request.correlationId).toBe(request.requestId);
  });
});
