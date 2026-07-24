import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { catchError, finalize, throwError, type Observable } from 'rxjs';
import type { RequestWithId } from '../middleware/request-id.middleware';
import { MetricsService } from './metrics.service';

/**
 * Emits one structured completion record per request and updates lightweight
 * in-process API latency/error metrics. No request bodies or secrets are logged.
 */
@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithId>();
    const response = context.switchToHttp().getResponse<Response>();
    const started = performance.now();
    let errorStatus: number | undefined;
    const module = context.getClass().name;

    return next.handle().pipe(
      catchError((error: unknown) => {
        errorStatus =
          typeof error === 'object' &&
          error !== null &&
          'getStatus' in error &&
          typeof error.getStatus === 'function'
            ? error.getStatus()
            : 500;
        return throwError(() => error);
      }),
      finalize(() => {
        const durationMs = Math.round((performance.now() - started) * 100) / 100;
        const status = errorStatus ?? response.statusCode;
        const route = request.route?.path ?? request.path;
        this.metrics.recordHttp(request.method, route, status, durationMs);
        if (!response.headersSent) response.setHeader('x-response-time-ms', durationMs);

        const record = JSON.stringify({
          timestamp: new Date().toISOString(),
          requestId: request.requestId,
          correlationId: request.correlationId,
          user: request.user?.userId ?? null,
          module,
          method: request.method,
          path: request.originalUrl,
          status,
          responseTimeMs: durationMs,
          message: 'HTTP request completed',
        });
        if (status >= 500) this.logger.error(record);
        else if (status >= 400) this.logger.warn(record);
        else this.logger.log(record);
      }),
    );
  }
}
