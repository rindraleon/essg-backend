import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { MAX_IMAGE_SIZE } from '../storage/multer.config';
import { normalizeStoragePrefix, STORAGE_PREFIXES } from '../storage/storage.constants';
import { StorageService } from '../storage/storage.service';
import { ImagePreset, resolvePresetFromPrefix } from './image.constants';
import { ImageOptimizerService } from './image-optimizer.service';

export interface UploadImageOptions {
  prefix?: string;
  preset?: ImagePreset;
  replaceUrl?: string | null;
}

export interface StoredImage {
  url: string;
  objectKey: string;
  filename: string;
  bucket: string;
  fileName: string;
  mimeType: string;
  size: number;
  originalSize: number;
  width?: number;
  height?: number;
  savedPercent: number;
}

@Injectable()
export class ImageUploadService {
  private readonly logger = new Logger(ImageUploadService.name);

  constructor(
    private readonly optimizer: ImageOptimizerService,
    private readonly storageService: StorageService,
  ) {}

  async upload(file: Express.Multer.File, options: UploadImageOptions = {}): Promise<StoredImage> {
    this.assertValidFile(file);

    const prefix = normalizeStoragePrefix(options.prefix ?? STORAGE_PREFIXES.images);
    const preset = options.preset ?? resolvePresetFromPrefix(prefix);

    const optimized = await this.optimizer.optimize(file.buffer, {
      preset,
      declaredMimetype: file.mimetype,
    });

    const fileName = this.optimizer.toWebpFileName(file.originalname);

    const stored = await this.storageService.upload(optimized.buffer, fileName, {
      mimetype: optimized.mimetype,
      prefix,
      metadata: {
        'x-amz-meta-optimized': 'sharp-webp',
        'x-amz-meta-original-format': optimized.originalFormat,
      },
    });

    const exists = await this.storageService.exists(stored.objectKey, stored.bucket);
    if (!exists) {
      throw new ServiceUnavailableException(
        "L'image n'a pas pu être enregistrée dans le stockage. Aucune URL n'a été conservée.",
      );
    }

    if (options.replaceUrl) {
      await this.storageService.deleteStoredRef(options.replaceUrl);
    }

    this.logger.log(
      `Image stockée: ${stored.bucket}/${stored.objectKey} (${optimized.size} o, -${optimized.savedPercent}%)`,
    );

    return {
      url: stored.url,
      objectKey: stored.objectKey,
      filename: stored.objectName,
      bucket: stored.bucket,
      fileName,
      mimeType: optimized.mimetype,
      size: optimized.size,
      originalSize: optimized.originalSize,
      width: optimized.width,
      height: optimized.height,
      savedPercent: optimized.savedPercent,
    };
  }

  async remove(url?: string | null): Promise<void> {
    await this.storageService.deleteStoredRef(url ?? undefined);
  }

  private assertValidFile(file?: Express.Multer.File): asserts file is Express.Multer.File {
    if (!file?.buffer || file.buffer.length === 0) {
      throw new BadRequestException(
        'Aucun fichier image reçu. Envoyez une image JPG, PNG, GIF ou WebP (5 Mo maximum).',
      );
    }
    if (file.size > MAX_IMAGE_SIZE) {
      throw new BadRequestException('Image trop volumineuse : 5 Mo maximum.');
    }
    if (!this.optimizer.isImageMimetype(file.mimetype)) {
      throw new BadRequestException(
        `Type de fichier non autorisé (${file.mimetype || 'inconnu'}). Formats acceptés : JPG, PNG, GIF, WebP.`,
      );
    }
  }
}
