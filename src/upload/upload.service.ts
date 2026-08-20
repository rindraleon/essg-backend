import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ALLOWED_DOCUMENT_MIMES,
  ALLOWED_IMAGE_MIMES,
  MAX_DOCUMENT_SIZE,
  MAX_IMAGE_SIZE,
} from '../common/storage/multer.config';
import { normalizeStoragePrefix, STORAGE_PREFIXES } from '../common/storage/storage.constants';
import { StorageService } from '../common/storage/storage.service';
import type { StorageUploadResult } from '../common/storage/interfaces/storage.interface';
import { PresignUploadDto } from './dto/presign-upload.dto';

export interface UploadedImageResult {
  url: string;
  filename: string;
  objectKey: string;
  bucket: string;
  fileName: string;
  mimeType: string;
  size: number;
}

@Injectable()
export class UploadService {
  constructor(private readonly storageService: StorageService) {}

  async uploadImage(file: Express.Multer.File, folder?: string): Promise<UploadedImageResult> {
    const prefix = normalizeStoragePrefix(folder || STORAGE_PREFIXES.images);
    const result = await this.storageService.upload(file.buffer, file.originalname, {
      mimetype: file.mimetype,
      prefix,
    });
    return this.toUploadedResult(result);
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

    const prefix = normalizeStoragePrefix(dto.folder || (isImage ? STORAGE_PREFIXES.images : STORAGE_PREFIXES.documents));
    return this.storageService.createPresignedUpload(dto.fileName, {
      mimetype: dto.mimeType,
      prefix,
    });
  }

  private toUploadedResult(result: StorageUploadResult): UploadedImageResult {
    return {
      url: result.url,
      filename: result.objectName,
      objectKey: result.objectKey,
      bucket: result.bucket,
      fileName: result.fileName,
      mimeType: result.mimeType,
      size: result.size,
    };
  }
}
