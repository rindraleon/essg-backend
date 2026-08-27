import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { extname } from 'node:path';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { measureAsync } from '../perf/perf.context';
import { MEDIA_ROUTE_PREFIX, isPrivateObjectKey } from './storage.constants';
import {
  PresignedDownload,
  PresignedUpload,
  StoredFileMetadata,
  StorageUploadOptions,
  StorageUploadResult,
} from './interfaces/storage.interface';

const DEFAULT_PRESIGN_EXPIRY = 10 * 60;

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: Client;
  private readonly defaultBucket: string;
  private readonly publicUrlBase: string;
  private readonly appUrl: string;
  private ready = false;

  constructor(private readonly configService: ConfigService) {
    this.defaultBucket = this.configService.get<string>('MINIO_BUCKET', 'essg');
    this.publicUrlBase = this.configService.get<string>('MINIO_PUBLIC_URL', '');
    this.appUrl = this.configService.get<string>('APP_URL', 'http://localhost:3000');

    this.client = new Client({
      endPoint: this.configService.get<string>('MINIO_ENDPOINT', 'localhost'),
      port: Number.parseInt(this.configService.get<string>('MINIO_PORT', '9000'), 10),
      useSSL: this.configService.get<string>('MINIO_USE_SSL', 'false') === 'true',
      accessKey: this.configService.get<string>('MINIO_ACCESS_KEY', ''),
      secretKey: this.configService.get<string>('MINIO_SECRET_KEY', ''),
    });
  }

  async onModuleInit(): Promise<void> {
    if (!this.isMinioConfigured()) {
      this.logger.error(
        'MinIO n’est pas configuré. Tous les fichiers doivent être stockés dans MinIO — aucun repli local.',
      );
      return;
    }
    try {
      await this.ensureBucket(this.defaultBucket);
      this.ready = true;
      this.logger.log(`Stockage MinIO prêt (bucket « ${this.defaultBucket} »)`);
    } catch (error) {
      this.ready = false;
      this.logger.error(
        `Impossible d'initialiser MinIO (bucket « ${this.defaultBucket} »)`,
        error instanceof Error ? error.stack : error,
      );
    }
  }

  isReady(): boolean {
    return this.ready && this.isMinioConfigured();
  }

  async ping(): Promise<boolean> {
    if (!this.isMinioConfigured()) return false;
    try {
      await this.client.bucketExists(this.defaultBucket);
      return true;
    } catch {
      return false;
    }
  }

  async ensureBucket(bucket: string): Promise<void> {
    const exists = await measureAsync('storage', () => this.client.bucketExists(bucket));
    if (!exists) {
      await measureAsync('storage', () => this.client.makeBucket(bucket, ''));
      this.logger.log(`Bucket MinIO « ${bucket} » créé`);
    }
  }

  async upload(
    buffer: Buffer,
    originalName: string,
    options: StorageUploadOptions = {},
  ): Promise<StorageUploadResult> {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('Fichier vide');
    }

    this.assertMinioAvailable();

    const bucket = options.bucket ?? this.defaultBucket;
    const extension =
      extname(originalName).toLowerCase() || this.extensionFromMime(options.mimetype);
    const prefix = options.prefix ? options.prefix.split('/').filter(Boolean).join('/') : '';
    const directory = prefix ? `${prefix}/` : '';
    const objectName = `${directory}${randomUUID()}${extension}`;
    const mimetype = options.mimetype ?? 'application/octet-stream';
    const privateObject = options.privateObject === true || isPrivateObjectKey(objectName);

    try {
      await this.ensureBucket(bucket);
      return await this.putMinioObject(
        buffer,
        objectName,
        bucket,
        mimetype,
        originalName,
        options.metadata,
        privateObject,
      );
    } catch (error) {
      if (error instanceof ServiceUnavailableException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(
        `Échec du stockage MinIO (${objectName})`,
        error instanceof Error ? error.stack : error,
      );
      throw new ServiceUnavailableException(
        'Impossible d’enregistrer le fichier dans MinIO. Vérifiez le service de stockage.',
      );
    }
  }

  async uploadPrivate(
    buffer: Buffer,
    originalName: string,
    options: StorageUploadOptions = {},
  ): Promise<StorageUploadResult> {
    return this.upload(buffer, originalName, {
      ...options,
      prefix: options.prefix ?? 'admissions',
      privateObject: true,
    });
  }

  async download(objectName: string, bucket = this.defaultBucket): Promise<Buffer> {
    this.assertMinioAvailable();
    try {
      const stream = await measureAsync('storage', () => this.client.getObject(bucket, objectName));
      return await this.streamToBuffer(stream);
    } catch {
      this.logger.warn(`Fichier « ${objectName} » introuvable dans MinIO`);
      throw new NotFoundException('Fichier introuvable');
    }
  }

  async openStream(objectName: string, bucket = this.defaultBucket): Promise<Readable> {
    this.assertMinioAvailable();
    try {
      return await measureAsync('storage', () => this.client.getObject(bucket, objectName));
    } catch {
      throw new NotFoundException('Fichier introuvable');
    }
  }

  async delete(objectName: string, bucket = this.defaultBucket): Promise<void> {
    if (!objectName || !this.isManagedObject(objectName)) return;
    this.assertMinioAvailable();
    try {
      await measureAsync('storage', () => this.client.removeObject(bucket, objectName));
    } catch (error) {
      this.logger.warn(
        `Échec de suppression MinIO de « ${objectName} »`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async deleteStoredRef(storedUrl?: string | null, bucket = this.defaultBucket): Promise<void> {
    if (!storedUrl) return;
    const objectName = this.extractObjectName(storedUrl);
    if (!objectName) return;
    await this.delete(objectName, bucket);
  }

  async exists(objectName: string, bucket = this.defaultBucket): Promise<boolean> {
    if (!this.isMinioConfigured()) return false;
    try {
      await measureAsync('storage', () => this.client.statObject(bucket, objectName));
      return true;
    } catch {
      return false;
    }
  }

  async getMetadata(
    objectName: string,
    bucket = this.defaultBucket,
  ): Promise<StoredFileMetadata | null> {
    if (!this.isMinioConfigured()) return null;
    try {
      const objectStat = await measureAsync('storage', () =>
        this.client.statObject(bucket, objectName),
      );
      const contentType = objectStat.metaData?.['content-type'] as string | undefined;
      return {
        size: objectStat.size,
        etag: objectStat.etag,
        lastModified: objectStat.lastModified,
        contentType,
      };
    } catch {
      return null;
    }
  }

  async createPresignedUpload(
    originalName: string,
    options: StorageUploadOptions & { expiresIn?: number } = {},
  ): Promise<PresignedUpload> {
    this.assertMinioAvailable();
    const bucket = options.bucket ?? this.defaultBucket;
    const extension =
      extname(originalName).toLowerCase() || this.extensionFromMime(options.mimetype);
    const prefix = options.prefix ? options.prefix.split('/').filter(Boolean).join('/') : '';
    const directory = prefix ? `${prefix}/` : '';
    const objectName = `${directory}${randomUUID()}${extension}`;
    const expiresIn = options.expiresIn ?? DEFAULT_PRESIGN_EXPIRY;
    const mimetype = options.mimetype ?? 'application/octet-stream';
    const privateObject = options.privateObject === true || isPrivateObjectKey(objectName);

    await this.ensureBucket(bucket);
    const rawUrl = await measureAsync('storage', () =>
      this.client.presignedPutObject(bucket, objectName, expiresIn),
    );

    return {
      uploadUrl: this.rewritePresignedHost(rawUrl),
      objectKey: objectName,
      bucket,
      publicUrl: privateObject ? objectName : this.getFileUrl(bucket, objectName),
      expiresIn,
      headers: { 'Content-Type': mimetype },
    };
  }

  async createPresignedDownload(
    objectName: string,
    options: { bucket?: string; expiresIn?: number } = {},
  ): Promise<PresignedDownload> {
    this.assertMinioAvailable();
    const bucket = options.bucket ?? this.defaultBucket;
    const expiresIn = options.expiresIn ?? DEFAULT_PRESIGN_EXPIRY;
    const rawUrl = await measureAsync('storage', () =>
      this.client.presignedGetObject(bucket, objectName, expiresIn),
    );
    return {
      url: this.rewritePresignedHost(rawUrl),
      objectKey: objectName,
      bucket,
      expiresIn,
    };
  }

  getFileUrl(_bucket: string, objectName: string): string {
    if (isPrivateObjectKey(objectName)) {
      return objectName;
    }
    return `/${MEDIA_ROUTE_PREFIX}/${objectName}`;
  }

  getMediaUrl(objectName: string): string {
    const baseUrl = this.appUrl.endsWith('/') ? this.appUrl.slice(0, -1) : this.appUrl;
    return `${baseUrl}/${MEDIA_ROUTE_PREFIX}/${objectName}`;
  }

  extractObjectName(storedUrl: string): string {
    let cleaned = storedUrl.split('?')[0];
    while (cleaned.endsWith('/')) cleaned = cleaned.slice(0, -1);
    if (!cleaned) return '';

    if (!/^https?:\/\//i.test(cleaned) && !cleaned.startsWith('/')) {
      return decodeURIComponent(cleaned);
    }

    try {
      const parsed = /^https?:\/\//i.test(cleaned) ? new URL(cleaned) : null;
      const pathname = parsed ? parsed.pathname : cleaned;
      const segments = pathname.split('/').filter(Boolean);
      const bucketIndex = segments.indexOf(this.defaultBucket);
      if (bucketIndex >= 0 && segments[bucketIndex + 1]) {
        return decodeURIComponent(segments.slice(bucketIndex + 1).join('/'));
      }
      const mediaIndex = segments.indexOf(MEDIA_ROUTE_PREFIX);
      if (mediaIndex >= 0 && segments[mediaIndex + 1]) {
        return decodeURIComponent(segments.slice(mediaIndex + 1).join('/'));
      }
      const uploadsIndex = segments.indexOf('uploads');
      if (uploadsIndex >= 0 && segments[uploadsIndex + 1]) {
        return decodeURIComponent(segments.slice(uploadsIndex + 1).join('/'));
      }
      return decodeURIComponent(segments.at(-1) ?? '');
    } catch {
      const parts = cleaned.split('/').filter(Boolean);
      return decodeURIComponent(parts.at(-1) ?? '');
    }
  }

  isManagedObject(objectName: string): boolean {
    if (!objectName) return false;
    if (objectName.startsWith('/images/')) return false;
    return !objectName.includes('..');
  }

  getDefaultBucket(): string {
    return this.defaultBucket;
  }

  private async putMinioObject(
    buffer: Buffer,
    objectName: string,
    bucket: string,
    mimetype: string,
    originalName: string,
    metadata?: Record<string, string>,
    privateObject = false,
  ): Promise<StorageUploadResult> {
    await measureAsync('storage', () =>
      this.client.putObject(bucket, objectName, buffer, buffer.length, {
        'Content-Type': mimetype,
        'x-amz-meta-original-name': this.sanitizeMeta(originalName),
        ...metadata,
      }),
    );
    this.logger.log(`Fichier enregistré dans MinIO : ${bucket}/${objectName}`);
    return {
      objectName,
      objectKey: objectName,
      bucket,
      url: privateObject ? objectName : this.getFileUrl(bucket, objectName),
      fileName: originalName,
      mimeType: mimetype,
      size: buffer.length,
    };
  }

  private rewritePresignedHost(url: string): string {
    if (!this.publicUrlBase) return url;
    try {
      const original = new URL(url);
      const publicBase = new URL(this.publicUrlBase);
      original.protocol = publicBase.protocol;
      original.host = publicBase.host;
      return original.toString();
    } catch {
      return url;
    }
  }

  private assertMinioAvailable(): void {
    if (!this.isMinioConfigured()) {
      throw new ServiceUnavailableException(
        'MinIO n’est pas configuré. Tous les fichiers doivent être stockés dans MinIO.',
      );
    }
  }

  private isMinioConfigured(): boolean {
    const accessKey = this.configService.get<string>('MINIO_ACCESS_KEY', '');
    const secretKey = this.configService.get<string>('MINIO_SECRET_KEY', '');
    if (!accessKey || !secretKey) return false;
    return !accessKey.startsWith('your-') && !secretKey.startsWith('your-');
  }

  private sanitizeMeta(value: string): string {
    return value.replace(/[^\w.\- ()àâäéèêëïîôùûüç]/gi, '_').slice(0, 180);
  }

  private extensionFromMime(mimetype?: string): string {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
    };
    return (mimetype && map[mimetype]) || '';
  }

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }
    return Buffer.concat(chunks);
  }
}
