import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';
import type { Request } from 'express';

type FileFilterCallback = (error: Error | null, acceptFile: boolean) => void;

export const ALLOWED_IMAGE_MIMES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
];

export const ALLOWED_DOCUMENT_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/jpg',
  'image/png',
];

export const ALLOWED_PROOF_MIMES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;

export function createMimeFilter(allowedMimes: string[]) {
  return (_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void => {
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new BadRequestException('Type de fichier non autorisé'), false);
    }
  };
}

export const imageUploadOptions = {
  storage: memoryStorage(),
  fileFilter: createMimeFilter(ALLOWED_IMAGE_MIMES),
  limits: { fileSize: MAX_IMAGE_SIZE },
};

export const documentUploadOptions = {
  storage: memoryStorage(),
  fileFilter: createMimeFilter(ALLOWED_DOCUMENT_MIMES),
  limits: { fileSize: MAX_DOCUMENT_SIZE },
};

export const proofUploadOptions = {
  storage: memoryStorage(),
  fileFilter: createMimeFilter(ALLOWED_PROOF_MIMES),
  limits: { fileSize: MAX_DOCUMENT_SIZE },
};
