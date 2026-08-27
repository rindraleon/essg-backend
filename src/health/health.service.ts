import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { API_SIGNATURE, API_VERSION } from '../common/constants/api.constants';
import { StorageService } from '../common/storage/storage.service';

export type HealthStatus = 'ok' | 'degraded' | 'down';
export type ComponentStatus = 'up' | 'down' | 'degraded' | 'skipped';

export interface ComponentHealth {
  status: ComponentStatus;
  responseTime: number;
  details?: string;
  criticality?: 'critical' | 'optional';
}

export interface HealthReport {
  status: HealthStatus;
  service: string;
  version: string;
  environment: string;
  signature: typeof API_SIGNATURE;
  uptime: number;
  timestamp: string;
  storage: 'minio' | 'unavailable';
  checks: {
    database: ComponentHealth;
    storage: ComponentHealth;
    memory: ComponentHealth;
  };
}

const DEFAULT_MEMORY_LIMIT_MB = 512;

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly storageService: StorageService,
    @Optional() @InjectDataSource() private readonly dataSource?: DataSource,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  async check(): Promise<HealthReport> {
    const [database, storage] = await Promise.all([this.checkDatabase(), this.checkStorage()]);
    const memory = this.checkMemory();

    const components = [database, storage, memory];
    const criticalDown = components.filter(
      (component) => component.status === 'down' && component.criticality !== 'optional',
    ).length;
    const anyDown = components.some(
      (component) => component.status === 'down' || component.status === 'degraded',
    );

    let status: HealthStatus = 'ok';
    if (database.status === 'down' && storage.status === 'down') {
      status = 'down';
    } else if (criticalDown > 0 || anyDown) {
      status = 'degraded';
    }

    return {
      status,
      service: this.configService?.get<string>('APP_NAME') ?? 'backend-essg',
      version: API_VERSION,
      environment:
        this.configService?.get<string>('NODE_ENV') ?? process.env.NODE_ENV ?? 'development',
      signature: API_SIGNATURE,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      storage: storage.status === 'up' ? 'minio' : 'unavailable',
      checks: { database, storage, memory },
    };
  }

  async isReady(): Promise<boolean> {
    const database = await this.checkDatabase();
    return database.status !== 'down';
  }

  private async checkDatabase(): Promise<ComponentHealth> {
    const startedAt = Date.now();
    if (!this.dataSource) {
      return { status: 'skipped', responseTime: 0, details: 'DataSource non injectée' };
    }
    try {
      if (!this.dataSource.isInitialized) {
        return {
          status: 'down',
          responseTime: Date.now() - startedAt,
          details: 'Connexion PostgreSQL non initialisée',
        };
      }
      await this.dataSource.query('SELECT 1');
      return {
        status: 'up',
        responseTime: Date.now() - startedAt,
        details: `PostgreSQL — ${this.dataSource.options.database as string}`,
        criticality: 'critical',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Sonde base de données en échec : ${message}`);
      return {
        status: 'down',
        responseTime: Date.now() - startedAt,
        details: message,
        criticality: 'critical',
      };
    }
  }

  private async checkStorage(): Promise<ComponentHealth> {
    const startedAt = Date.now();
    try {
      const reachable = await this.storageService.ping();
      return {
        status: reachable ? 'up' : 'down',
        responseTime: Date.now() - startedAt,
        details: reachable
          ? `MinIO — bucket « ${this.storageService.getDefaultBucket?.() ?? 'essg'} »`
          : 'MinIO injoignable ou non configuré (aucun upload possible)',
        criticality: 'critical',
      };
    } catch (error) {
      return {
        status: 'down',
        responseTime: Date.now() - startedAt,
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private checkMemory(): ComponentHealth {
    const { heapUsed, heapTotal, rss } = process.memoryUsage();
    const limitMb = Number(
      this.configService?.get<string>('HEALTH_MEMORY_LIMIT_MB') ?? DEFAULT_MEMORY_LIMIT_MB,
    );
    const limit = Number.isFinite(limitMb) && limitMb > 0 ? limitMb : DEFAULT_MEMORY_LIMIT_MB;
    const usedMb = this.mb(heapUsed);
    return {
      status: usedMb > limit ? 'down' : 'up',
      responseTime: 0,
      details: `heap ${usedMb}/${this.mb(heapTotal)} Mo (seuil ${limit} Mo) — rss ${this.mb(rss)} Mo`,
    };
  }

  private mb(bytes: number): number {
    return Math.round((bytes / (1024 * 1024)) * 10) / 10;
  }
}
