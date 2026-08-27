import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { detectFileType } from '../utils/file-type.util';
import {
  IMAGE_OUTPUT_EXTENSION,
  IMAGE_OUTPUT_MIME,
  IMAGE_PRESETS,
  ImagePreset,
  ImagePresetConfig,
} from './image.constants';

export interface OptimizedImage {
  buffer: Buffer;
  mimetype: typeof IMAGE_OUTPUT_MIME;
  extension: typeof IMAGE_OUTPUT_EXTENSION;
  width?: number;
  height?: number;
  size: number;
  originalSize: number;
  originalFormat: string;
  savedPercent: number;
  reused: boolean;
}

const SUPPORTED_INPUT_FORMATS = new Set([
  'jpeg',
  'jpg',
  'png',
  'webp',
  'gif',
  'avif',
  'tiff',
  'heif',
  'svg',
]);

const IMAGE_MIME_PREFIX = 'image/';

@Injectable()
export class ImageOptimizerService {
  private readonly logger = new Logger(ImageOptimizerService.name);

  isImageMimetype(mimetype?: string): boolean {
    if (!mimetype) return false;
    return mimetype.toLowerCase().startsWith(IMAGE_MIME_PREFIX);
  }

  getPreset(preset: ImagePreset = 'default'): ImagePresetConfig {
    return IMAGE_PRESETS[preset] ?? IMAGE_PRESETS.default;
  }

  async optimize(
    buffer: Buffer,
    options: { preset?: ImagePreset; declaredMimetype?: string } = {},
  ): Promise<OptimizedImage> {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('Fichier image vide.');
    }

    const config = this.getPreset(options.preset);
    const detected = detectFileType(buffer, options.declaredMimetype);
    if (!detected.mimetype.startsWith(IMAGE_MIME_PREFIX)) {
      throw new BadRequestException(
        "Le fichier envoyé n'est pas une image valide (JPG, PNG, GIF ou WebP attendus).",
      );
    }

    let metadata: sharp.Metadata;
    try {
      metadata = await sharp(buffer, { failOn: 'error' }).metadata();
    } catch (error) {
      this.logger.warn(
        `Image illisible par Sharp: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadRequestException("L'image envoyée est corrompue ou illisible.");
    }

    const format = (metadata.format ?? '').toLowerCase();
    if (!SUPPORTED_INPUT_FORMATS.has(format)) {
      throw new BadRequestException(`Format d'image non pris en charge : ${format || 'inconnu'}.`);
    }

    if (this.isAlreadyOptimized(metadata, buffer.length, config)) {
      return {
        buffer,
        mimetype: IMAGE_OUTPUT_MIME,
        extension: IMAGE_OUTPUT_EXTENSION,
        width: metadata.width,
        height: metadata.height,
        size: buffer.length,
        originalSize: buffer.length,
        originalFormat: format,
        savedPercent: 0,
        reused: true,
      };
    }

    const animated = (metadata.pages ?? 1) > 1;

    try {
      const pipeline = sharp(buffer, { failOn: 'error', animated })
        .rotate()
        .resize({
          width: config.maxWidth,
          height: config.maxHeight,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({
          quality: config.quality,
          effort: 4,
          smartSubsample: true,
          nearLossless: false,
        });

      const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });

      if (format === 'webp' && data.length >= buffer.length) {
        return {
          buffer,
          mimetype: IMAGE_OUTPUT_MIME,
          extension: IMAGE_OUTPUT_EXTENSION,
          width: metadata.width,
          height: metadata.height,
          size: buffer.length,
          originalSize: buffer.length,
          originalFormat: format,
          savedPercent: 0,
          reused: true,
        };
      }

      const savedPercent = Math.max(
        0,
        Math.round(((buffer.length - data.length) / buffer.length) * 100),
      );

      this.logger.log(
        `Image optimisée: ${format} ${this.formatSize(buffer.length)} → webp ${this.formatSize(
          data.length,
        )} (-${savedPercent}%, ${info.width}x${info.height})`,
      );

      return {
        buffer: data,
        mimetype: IMAGE_OUTPUT_MIME,
        extension: IMAGE_OUTPUT_EXTENSION,
        width: info.width,
        height: info.height,
        size: data.length,
        originalSize: buffer.length,
        originalFormat: format,
        savedPercent,
        reused: false,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(
        'Échec de la conversion WebP',
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadRequestException(
        "La conversion de l'image a échoué. Réessayez avec un autre fichier (JPG, PNG ou WebP).",
      );
    }
  }

  toWebpFileName(originalName: string): string {
    const base = (originalName || 'image').replace(/\.[^./\\]+$/, '').trim() || 'image';
    const safeBase = base
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60);
    return `${safeBase || 'image'}${IMAGE_OUTPUT_EXTENSION}`;
  }

  private isAlreadyOptimized(
    metadata: sharp.Metadata,
    size: number,
    config: ImagePresetConfig,
  ): boolean {
    if ((metadata.format ?? '').toLowerCase() !== 'webp') return false;
    if (size > config.skipReencodeUnder) return false;
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    if (width === 0 || height === 0) return false;
    if (width > config.maxWidth || height > config.maxHeight) return false;
    return !metadata.orientation || metadata.orientation === 1;
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
  }
}
