import { Injectable, NestMiddleware, HttpStatus } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { RateLimitService } from '../../infrastructure/rate-limit/rate-limit.service';
import { API_SIGNATURE, API_VERSION, API_SIGNATURE_HEADER, API_VERSION_HEADER } from '../constants/api.constants';


@Injectable()
export class GlobalRateLimitMiddleware implements NestMiddleware {
  private readonly limit: number;
  private readonly windowSeconds: number;

  constructor(private readonly rateLimitService: RateLimitService) {
    this.limit = Number.parseInt(process.env.GLOBAL_RATE_LIMIT_LIMIT || '200', 10);
    this.windowSeconds = Number.parseInt(process.env.GLOBAL_RATE_LIMIT_WINDOW || '60', 10);
  }

  use(req: Request, res: Response, next: NextFunction): void {
    // Ne pas rate-limiter les sondes de santé
    if (req.path.startsWith('/health')) {
      next();
      return;
    }

    const ip = this.resolveIp(req);
    const result = this.rateLimitService.consume('global', ip, this.limit, this.windowSeconds);

    res.setHeader('X-RateLimit-Limit', String(result.limit));
    res.setHeader('X-RateLimit-Remaining', String(result.remaining));

    if (!result.allowed) {
      res.setHeader('Retry-After', String(result.retryAfter));
      res.setHeader(API_SIGNATURE_HEADER, API_SIGNATURE);
      res.setHeader(API_VERSION_HEADER, API_VERSION);
      res.status(HttpStatus.TOO_MANY_REQUESTS).json({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Trop de requêtes. Réessayez dans quelques secondes.',
        data: null,
        signature: API_SIGNATURE,
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
      });
      return;
    }

    next();
  }

  private resolveIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0].trim();
    }
    if (Array.isArray(forwarded) && forwarded.length > 0) {
      return forwarded[0].split(',')[0].trim();
    }
    return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
  }
}
