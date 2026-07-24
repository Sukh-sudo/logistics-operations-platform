import {
  Injectable,
  NestMiddleware,
} from '@nestjs/common';

import { randomUUID } from 'crypto';

import { Request, Response, NextFunction } from 'express';

// Extend Express request object
export interface RequestWithId extends Request {
  requestId?: string;
  correlationId?: string;
  user?: { userId?: string };
}

@Injectable()
export class RequestIdMiddleware
  implements NestMiddleware
{
  use(
    req: RequestWithId,
    res: Response,
    next: NextFunction,
  ) {

    // A request ID identifies this HTTP hop. A caller-provided correlation ID
    // may connect it to a larger workflow, but is length-limited before logging.
    req.requestId = randomUUID();
    const incomingCorrelation = req.header('x-correlation-id');
    req.correlationId =
      incomingCorrelation && incomingCorrelation.length <= 128
        ? incomingCorrelation
        : req.requestId;

    // Expose request ID in response headers
    res.setHeader('x-request-id', req.requestId);
    res.setHeader('x-correlation-id', req.correlationId);

    next();
  }
}
