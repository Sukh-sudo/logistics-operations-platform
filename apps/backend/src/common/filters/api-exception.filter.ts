import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import type { RequestWithId } from '../middleware/request-id.middleware';

interface ErrorBody {
  code?: string;
  message?: string | string[];
  error?: string;
}

/** Converts every thrown HTTP or infrastructure error to the documented shape. */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest<RequestWithId & Request>();
    const response = http.getResponse<Response>();
    const normalized = this.normalize(exception);

    if (normalized.status >= 500) {
      this.logger.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        requestId: request.requestId,
        correlationId: request.correlationId,
        user: request.user?.userId ?? null,
        module: 'HTTP',
        message: normalized.logMessage,
        path: request.originalUrl,
      }));
    }

    response.status(normalized.status).json({
      success: false,
      error: {
        code: normalized.code,
        message: normalized.message,
        ...(normalized.details && { details: normalized.details }),
      },
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
      ...(request.requestId && { requestId: request.requestId }),
    });
  }

  private normalize(exception: unknown) {
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const conflict = exception.code === 'P2002';
      return {
        status: conflict ? HttpStatus.CONFLICT : HttpStatus.INTERNAL_SERVER_ERROR,
        code: conflict ? 'DATABASE_CONFLICT' : 'DATABASE_ERROR',
        message: conflict ? 'A record with the same unique value already exists.' : 'Database operation failed.',
        logMessage: `Prisma ${exception.code}`,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const value: ErrorBody = typeof body === 'string' ? { message: body } : body as ErrorBody;
      const rawMessage = value.message ?? exception.message;
      const details = Array.isArray(rawMessage) ? rawMessage : undefined;
      return {
        status,
        code: value.code ?? this.codeForStatus(status, Boolean(details)),
        message: details ? 'Request validation failed.' : rawMessage,
        details,
        logMessage: exception.message,
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
      logMessage: exception instanceof Error ? exception.stack ?? exception.message : String(exception),
    };
  }

  private codeForStatus(status: number, validation: boolean) {
    if (validation) return 'VALIDATION_ERROR';
    const codes: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
      [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
      [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
      [HttpStatus.CONFLICT]: 'CONFLICT',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
      [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
      [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
    };
    return codes[status] ?? `HTTP_${status}`;
  }
}
