import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { map, type Observable } from 'rxjs';
import type { RequestWithId } from '../middleware/request-id.middleware';

export interface PaginationMetadata {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
  timestamp: string;
  requestId?: string;
  pagination?: PaginationMetadata;
}

type CollectionItem = Record<string, unknown>;

/**
 * Provides one HTTP response contract without changing domain-service return
 * values. Optional collection controls are intentionally applied only when a
 * caller requests them, preserving existing unpaginated reads.
 */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithId>();
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(map((value: unknown) => {
      // HTTP 204 responses must not contain a response body.
      if (response.statusCode === 204) return value;

      const collection: { data: unknown; pagination?: PaginationMetadata } = Array.isArray(value)
        ? this.transformCollection(value, request.query as Record<string, unknown>)
        : { data: value };

      return {
        success: true,
        data: collection.data,
        ...(collection.pagination && { pagination: collection.pagination }),
        timestamp: new Date().toISOString(),
        ...(request.requestId && { requestId: request.requestId }),
      } satisfies SuccessEnvelope<unknown>;
    }));
  }

  private transformCollection(
    input: unknown[],
    query: Record<string, unknown>,
  ): { data: unknown[]; pagination?: PaginationMetadata } {
    const requestedFilters = Object.entries(query)
      .filter(([key, value]) =>
        !['page', 'pageSize', 'sort'].includes(key) &&
        typeof value === 'string',
      )
      .map(([key, value]) => [key.replace(/^filter\./, ''), value as string] as const);
    const sort = typeof query.sort === 'string' ? query.sort : undefined;
    const hasCollectionControls =
      query.page !== undefined ||
      query.pageSize !== undefined ||
      sort !== undefined ||
      requestedFilters.some(([field]) => this.hasField(input, field));

    if (!hasCollectionControls) return { data: input };

    let items = [...input];
    for (const [field, expected] of requestedFilters) {
      // Query parameters used by endpoint-specific service filters are left
      // alone when the returned representation does not expose that field.
      if (!this.hasField(items, field)) continue;
      items = items.filter(item =>
        String(this.readField(item as CollectionItem, field)).toLowerCase() ===
        expected.toLowerCase(),
      );
    }

    if (sort) {
      const descending = sort.startsWith('-');
      const field = descending ? sort.slice(1) : sort;
      if (!field || (!this.hasField(items, field) && items.length > 0)) {
        throw new BadRequestException(`Cannot sort this collection by ${field || 'an empty field'}`);
      }
      items.sort((left, right) => {
        const a = this.readField(left as CollectionItem, field);
        const b = this.readField(right as CollectionItem, field);
        const comparison = String(a ?? '').localeCompare(String(b ?? ''), undefined, {
          numeric: true,
          sensitivity: 'base',
        });
        return descending ? -comparison : comparison;
      });
    }

    const page = this.positiveInteger(query.page, 'page', 1);
    const pageSize = this.positiveInteger(query.pageSize, 'pageSize', 50, 200);
    const total = items.length;
    const start = (page - 1) * pageSize;

    return {
      data: items.slice(start, start + pageSize),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
      },
    };
  }

  private positiveInteger(
    value: unknown,
    name: string,
    fallback: number,
    maximum?: number,
  ) {
    if (value === undefined) return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || (maximum && parsed > maximum)) {
      throw new BadRequestException(
        `${name} must be a positive integer${maximum ? ` no greater than ${maximum}` : ''}`,
      );
    }
    return parsed;
  }

  private hasField(items: unknown[], field: string) {
    return items.some(item =>
      item !== null &&
      typeof item === 'object' &&
      this.readField(item as CollectionItem, field) !== undefined,
    );
  }

  private readField(item: CollectionItem, field: string): unknown {
    return field.split('.').reduce<unknown>((current, segment) => {
      if (current === null || typeof current !== 'object') return undefined;
      return (current as CollectionItem)[segment];
    }, item);
  }
}
