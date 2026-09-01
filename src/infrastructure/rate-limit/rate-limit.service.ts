import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfter: number;
  skipped: boolean;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly enabled: boolean;
  private readonly entries = new Map<string, RateLimitEntry>();

  constructor(configService: ConfigService) {
    this.enabled = configService.get<string>('RATE_LIMIT_ENABLED', 'true') !== 'false';
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  consume(
    scope: string,
    identifier: string,
    limit: number,
    windowSeconds: number,
  ): RateLimitResult {
    if (!this.enabled) {
      return { allowed: true, limit, remaining: limit, retryAfter: 0, skipped: true };
    }

    const key = this.key(scope, identifier);
    const now = Date.now();
    const current = this.entries.get(key);
    const entry =
      !current || current.resetAt <= now
        ? { count: 1, resetAt: now + windowSeconds * 1000 }
        : { ...current, count: current.count + 1 };
    this.entries.set(key, entry);

    const remaining = Math.max(0, limit - entry.count);
    const allowed = entry.count <= limit;
    const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));

    if (!allowed) {
      this.logger.warn(
        `Quota « ${scope} » dépassé (${entry.count}/${limit}) — nouvelle tentative dans ${retryAfter}s`,
      );
    }

    return {
      allowed,
      limit,
      remaining,
      retryAfter: allowed ? 0 : retryAfter,
      skipped: false,
    };
  }

  reset(scope: string, identifier: string): void {
    this.entries.delete(this.key(scope, identifier));
  }

  private key(scope: string, identifier: string): string {
    const hash = createHash('sha256').update(identifier).digest('hex').slice(0, 32);
    return `${scope}:${hash}`;
  }
}
