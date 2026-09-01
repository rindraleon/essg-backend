import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { RATE_LIMIT_KEY, RateLimitOptions } from './rate-limit.decorator';
import { RateLimitService } from './rate-limit.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimitService: RateLimitService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!options) return true;

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const identifier = this.buildIdentifier(request, options);
    const result = this.rateLimitService.consume(
      options.scope,
      identifier,
      options.limit,
      options.windowSeconds,
    );

    if (result.skipped) return true;

    response.setHeader('X-RateLimit-Limit', String(result.limit));
    response.setHeader('X-RateLimit-Remaining', String(result.remaining));

    if (!result.allowed) {
      response.setHeader('Retry-After', String(result.retryAfter));
      throw new HttpException(
        options.message ?? 'Trop de requêtes. Merci de réessayer plus tard.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private buildIdentifier(request: Request, options: RateLimitOptions): string {
    const ip = this.resolveIp(request);
    if (options.strategy !== 'ip-email') return ip;

    const body = request.body as { email?: unknown } | undefined;
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    return email ? `${ip}|${email}` : ip;
  }

  private resolveIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0].trim();
    }
    if (Array.isArray(forwarded) && forwarded.length > 0) {
      return forwarded[0].split(',')[0].trim();
    }
    return request.ip ?? request.socket?.remoteAddress ?? 'inconnu';
  }
}
