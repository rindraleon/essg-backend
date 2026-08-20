import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { API_MESSAGE_KEY } from '../decorators/api-message.decorator';
import { SKIP_TRANSFORM_KEY } from '../decorators/skip-transform.decorator';
import { ApiResponse, PaginatedData } from '../interfaces/api-response.interface';

function defaultMessage(statusCode: number): string {
  switch (statusCode as HttpStatus) {
    case HttpStatus.CREATED:
      return 'Ressource créée avec succès';
    case HttpStatus.NO_CONTENT:
      return 'Opération effectuée avec succès';
    default:
      return 'Données récupérées avec succès';
  }
}

function isPaginatedData(value: unknown): value is PaginatedData<unknown> {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<PaginatedData<unknown>>;
  return Array.isArray(candidate.items) && typeof candidate.meta === 'object' && candidate.meta !== null;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<unknown>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<unknown>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse<Response>();
    const statusCode = response.statusCode ?? HttpStatus.OK;
    const handler = context.getHandler();
    if (Reflect.getMetadata(SKIP_TRANSFORM_KEY, handler)) {
      return next.handle() as Observable<ApiResponse<unknown>>;
    }
    const metadataMessage = Reflect.getMetadata(API_MESSAGE_KEY, handler) as string | undefined;
    const message: string = metadataMessage ?? defaultMessage(statusCode);

    return next.handle().pipe(
      map((data: T) => {
        if (isPaginatedData(data)) {
          return {
            statusCode,
            message,
            data: data.items,
            meta: data.meta,
          };
        }

        return {
          statusCode,
          message,
          data: data ?? null,
        };
      }),
    );
  }
}
