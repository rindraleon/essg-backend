import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { createPerfStore, runWithPerf } from '../perf/perf.context';

const DEFAULT_SLOW_MS = 400;

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Perf');
  private readonly enabled: boolean;
  private readonly alwaysLog: boolean;
  private readonly slowMs: number;

  constructor(private readonly configService: ConfigService) {
    const env = this.configService.get<string>('NODE_ENV', 'development');
    this.alwaysLog = this.configService.get<string>('PERF_LOG', 'false') === 'true';
    this.enabled = this.alwaysLog || env !== 'production';
    this.slowMs = Number(this.configService.get<string>('PERF_SLOW_MS', String(DEFAULT_SLOW_MS)));
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!this.enabled) {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const store = createPerfStore();
    const started = Date.now();

    return runWithPerf(store, () =>
      next.handle().pipe(
        tap({
          next: (body) => this.finish(request, response, store, started, body),
          error: (error: unknown) =>
            this.finish(request, response, store, started, undefined, true, error),
        }),
      ),
    );
  }

  private finish(
    request: Request,
    response: Response,
    store: ReturnType<typeof createPerfStore>,
    started: number,
    body: unknown,
    failed = false,
    error?: unknown,
  ): void {
    const totalMs = Date.now() - started;
    const size = this.estimateSize(body);
    if (!response.headersSent) {
      response.setHeader('X-Response-Time', `${totalMs}ms`);
      response.setHeader('X-DB-Time', `${store.dbMs}ms`);
      response.setHeader('X-DB-Queries', String(store.dbQueries));
      response.setHeader('X-Storage-Time', `${store.storageMs}ms`);
      response.setHeader('X-Response-Size', String(size));
    }

    const shouldLog = this.alwaysLog || totalMs >= this.slowMs || failed;
    if (!shouldLog) return;

    const payload = {
      method: request.method,
      path: request.originalUrl ?? request.url,
      status: this.resolveStatus(response, error),
      totalMs,
      dbMs: store.dbMs,
      dbQueries: store.dbQueries,
      storageMs: store.storageMs,
      storageOps: store.storageOps,
      size,
      failed,
    };
    if (failed || totalMs >= this.slowMs) {
      this.logger.warn(JSON.stringify(payload));
    } else {
      this.logger.debug(JSON.stringify(payload));
    }
  }

  private resolveStatus(response: Response, error?: unknown): number {
    if (error instanceof HttpException) return error.getStatus();
    if (error) return 500;
    return response.statusCode;
  }

  private estimateSize(body: unknown): number {
    if (body == null) return 0;
    if (Buffer.isBuffer(body)) return body.length;
    if (typeof body === 'string') return Buffer.byteLength(body);
    try {
      return Buffer.byteLength(JSON.stringify(body));
    } catch {
      return 0;
    }
  }
}
