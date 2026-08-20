import { Injectable } from '@nestjs/common';
import { StorageService } from '../common/storage/storage.service';

@Injectable()
export class HealthService {
  constructor(private readonly storageService: StorageService) {}

  async check() {
    const storage = await this.storageService.ping();
    return {
      status: storage ? 'ok' : 'degraded',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      storage: storage ? 'minio' : 'unavailable',
    };
  }
}
