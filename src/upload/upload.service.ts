import { BadRequestException, Injectable } from '@nestjs/common';
import { ImageUploadService, StoredImage } from '../common/images/image-upload.service';
import { resolvePresetFromPrefix } from '../common/images/image.constants';
import {
  ALLOWED_DOCUMENT_MIMES,
  ALLOWED_IMAGE_MIMES,
  MAX_DOCUMENT_SIZE,
  MAX_IMAGE_SIZE,
} from '../common/storage/multer.config';
import { normalizeStoragePrefix, STORAGE_PREFIXES } from '../common/storage/storage.constants';
import { StorageService } from '../common/storage/storage.service';
import { PresignUploadDto } from './dto/presign-upload.dto';

export interface UploadedImageResult {
  url: string;
  filename: string;
  objectKey: string;
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
export class UploadService {
  constructor(
    private readonly storageService: StorageService,
    private readonly imageUploadService: ImageUploadService,
  ) {}

  async uploadImage(file: Express.Multer.File, folder?: string): Promise<UploadedImageResult> {
    const prefix = normalizeStoragePrefix(folder || STORAGE_PREFIXES.images);
    const stored = await this.imageUploadService.upload(file, {
      prefix,
      preset: resolvePresetFromPrefix(prefix),
    });
    return this.toUploadedResult(stored);
  }

  async presign(dto: PresignUploadDto) {
    const isImage = ALLOWED_IMAGE_MIMES.includes(dto.mimeType);
    const isDocument = ALLOWED_DOCUMENT_MIMES.includes(dto.mimeType);
    if (!isImage && !isDocument) {
      throw new BadRequestException('Type de fichier non autorisé');
    }
    const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_DOCUMENT_SIZE;
    if (dto.size > maxSize) {
      throw new BadRequestException('Fichier trop volumineux');
    }

    const prefix = normalizeStoragePrefix(
      dto.folder || (isImage ? STORAGE_PREFIXES.images : STORAGE_PREFIXES.documents),
    );
    return this.storageService.createPresignedUpload(dto.fileName, {
      mimetype: dto.mimeType,
      prefix,
    });
  }

  private toUploadedResult(stored: StoredImage): UploadedImageResult {
    return {
      url: stored.url,
      filename: stored.filename,
      objectKey: stored.objectKey,
      bucket: stored.bucket,
      fileName: stored.fileName,
      mimeType: stored.mimeType,
      size: stored.size,
      originalSize: stored.originalSize,
      width: stored.width,
      height: stored.height,
      savedPercent: stored.savedPercent,
    };
  }
}
