import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';

import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(
    exception: Prisma.PrismaClientKnownRequestError,
    host: ArgumentsHost,
  ) {
    const response = host.switchToHttp().getResponse<Response>();

    // Handle unique constraint violations
    if (exception.code === 'P2002') {
      
      return response.status(HttpStatus.CONFLICT).json({
        message: 'Duplicate record detected',
        prismaCode: exception.code,
      });
    }

    // Generic database failure response
    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      message: 'Database operation failed',
      prismaCode: exception.code,
    });
  }
}