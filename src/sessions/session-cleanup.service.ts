import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { REFRESH_TOKEN_TTL_MS } from './sessions.constants';

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const RETENTION_MS = REFRESH_TOKEN_TTL_MS;

@Injectable()
export class SessionCleanupService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;

  constructor(private readonly sessionsService: SessionsService) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => {
      void this.runCleanup();
    }, CLEANUP_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async runCleanup(): Promise<number> {
    return this.sessionsService.cleanupExpired(new Date(Date.now() - RETENTION_MS));
  }
}
