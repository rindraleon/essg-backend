import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';
import { isPrivateObjectKey } from '../common/storage/storage.constants';
import { StorageService } from '../common/storage/storage.service';

@Controller('media')
export class MediaController {
  constructor(private readonly storageService: StorageService) {}

  @Get(':prefix/:filename')
  @SkipTransform()
  async serve(
    @Param('prefix') prefix: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ): Promise<void> {
    const key = `${decodeURIComponent(prefix ?? '')}/${decodeURIComponent(filename ?? '')}`.replace(
      /^\/+/,
      '',
    );
    if (!prefix || !filename || key.includes('..') || isPrivateObjectKey(key)) {
      throw new NotFoundException('Fichier introuvable');
    }

    const metadata = await this.storageService.getMetadata(key);
    if (!metadata) {
      throw new NotFoundException('Fichier introuvable');
    }

    const stream = await this.storageService.openStream(key);
    res.setHeader('Content-Type', metadata.contentType || this.guessMime(key));
    res.setHeader('Content-Length', String(metadata.size));
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    stream.pipe(res);
  }

  private guessMime(objectName: string): string {
    const ext = objectName.split('.').pop()?.toLowerCase();
    const map: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      pdf: 'application/pdf',
      svg: 'image/svg+xml',
    };
    return (ext && map[ext]) || 'application/octet-stream';
  }
}
