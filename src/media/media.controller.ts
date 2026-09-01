import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';
import { API_SIGNATURE, API_SIGNATURE_HEADER } from '../common/constants/api.constants';
import { isPrivateObjectKey } from '../common/storage/storage.constants';
import { StorageService } from '../common/storage/storage.service';

@ApiTags('Upload & médias')
@Controller('media')
export class MediaController {
  constructor(private readonly storageService: StorageService) {}

  @Get('*path')
  @SkipTransform()
  @ApiOperation({
    summary: 'Servir un média public',
    description:
      'Retourne le binaire du fichier (image WebP, PDF public…). Les objets privés (`admissions/…`) sont volontairement introuvables sur cette route. Réponse signée via l’en-tête `X-Api-Signature: ITDCMADA`.',
  })
  @ApiParam({
    name: 'path',
    example: 'avatars/6f1c1f2e-0b4e-4a1f-9c3b-7f0a1b2c3d4e.webp',
    description: 'Clé de l’objet dans le bucket (dossier + nom de fichier).',
  })
  async serve(@Param('path') path: string | string[], @Res() res: Response): Promise<void> {
    const key = (Array.isArray(path) ? path.join('/') : (path ?? ''))
      .split('/')
      .map((segment) => decodeURIComponent(segment))
      .filter(Boolean)
      .join('/');

    if (!key || key.includes('..') || isPrivateObjectKey(key)) {
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
    res.setHeader(API_SIGNATURE_HEADER, API_SIGNATURE);
    if (metadata.etag) res.setHeader('ETag', metadata.etag);
    stream.pipe(res);
  }

  @ApiExcludeEndpoint()
  @Get()
  @SkipTransform()
  root(): never {
    throw new NotFoundException('Fichier introuvable');
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
