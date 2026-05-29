import {
  Injectable,
  NestMiddleware,
} from '@nestjs/common';

import { randomUUID } from 'crypto';

import { Request, Response, NextFunction } from 'express';

// Extend Express request object
export interface RequestWithId extends Request {
  requestId?: string;
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

    // Generate unique request correlation ID
    req.requestId = randomUUID();

    // Expose request ID in response headers
    res.setHeader('x-request-id', req.requestId);

    next();
  }
}