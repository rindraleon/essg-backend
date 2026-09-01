import { Injectable, OnModuleDestroy } from '@nestjs/common';
import {
  buildCacheKey,
  buildResourcePrefix,
  CACHE_TTL,
  type CacheResource,
} from './cache.constants';

export interface CacheOptions {
  ttl?: number;
  stampedeProtection?: boolean;
}

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly pending = new Map<string, Promise<unknown>>();
  private readonly cleanupTimer = setInterval(() => this.removeExpired(), 60_000);

  listKey(resource: CacheResource, params: Record<string, unknown> = {}): string {
    return buildCacheKey(resource, 'list', params);
  }

  itemKey(resource: CacheResource, id: string | number): string {
    return buildCacheKey(resource, 'id', id);
  }

  slugKey(resource: CacheResource, slug: string): string {
    return buildCacheKey(resource, 'slug', slug);
  }

  viewKey(
    resource: CacheResource,
    segment: string,
    params?: Record<string, unknown> | string | number,
  ): string {
    return buildCacheKey(resource, segment, params);
  }

  get<T>(key: string): T | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return null;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttl: number = CACHE_TTL.MEDIUM): void {
    this.entries.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
  }

  async getOrSet<T>(key: string, loader: () => Promise<T>, options: CacheOptions = {}): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) return cached;

    if (options.stampedeProtection) {
      const existing = this.pending.get(key);
      if (existing) return existing as Promise<T>;
    }

    const request = this.loadAndCache(key, loader, options.ttl ?? CACHE_TTL.MEDIUM);
    if (options.stampedeProtection) this.pending.set(key, request);
    try {
      return await request;
    } finally {
      this.pending.delete(key);
    }
  }

  invalidateKey(key: string): void {
    this.entries.delete(key);
  }

  invalidateResource(...resources: CacheResource[]): void {
    const prefixes = resources.map(buildResourcePrefix);
    for (const key of this.entries.keys()) {
      if (prefixes.some((prefix) => key.startsWith(prefix))) this.entries.delete(key);
    }
  }

  isAvailable(): boolean {
    return true;
  }

  onModuleDestroy(): void {
    clearInterval(this.cleanupTimer);
    this.entries.clear();
    this.pending.clear();
  }

  private async loadAndCache<T>(key: string, loader: () => Promise<T>, ttl: number): Promise<T> {
    const value = await loader();
    this.set(key, value, ttl);
    return value;
  }

  private removeExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
  }
}
