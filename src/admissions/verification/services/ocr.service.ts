import { Injectable, Logger } from '@nestjs/common';

export interface OcrResult {
  text: string;
  confidence: number;
  method: 'ocr';
  error?: string;
}

type TesseractModule = typeof import('tesseract.js');
type CreateWorkerFn = TesseractModule['createWorker'];
type OcrWorker = Awaited<ReturnType<CreateWorkerFn>>;

const IMAGE_SIZE_ERROR_PATTERN = /(\d{1,10}x\d{1,10}) vs min width of (\d{1,10})/i;

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  async extractWithOcr(buffer: Buffer, mimetype: string): Promise<OcrResult> {
    // Pour JPEG/PNG: tentative OCR via tesseract.js
    if (mimetype.includes('image')) {
      return this.performImageOcr(buffer);
    }

    if (mimetype === 'application/pdf') {
      return {
        text: '',
        confidence: 0,
        method: 'ocr',
        error:
          'PDF scanné détecté : conversion PDF→image non disponible, texte non extractible sans OCR avancé',
      };
    }

    return {
      text: '',
      confidence: 0,
      method: 'ocr',
      error: 'Type de fichier non supporté pour OCR',
    };
  }

  private async validateImageSize(
    buffer: Buffer,
  ): Promise<{ width: number; height: number } | null> {
    try {
      const { default: sharp } = await import('sharp');
      const meta = await sharp(buffer).metadata();
      if (typeof meta.width === 'number' && typeof meta.height === 'number') {
        return { width: meta.width, height: meta.height };
      }
    } catch (error: unknown) {
      this.logger.warn(
        'Impossible de déterminer les dimensions avec sharp — repli sur l’analyse PNG',
        error instanceof Error ? error.message : error,
      );
    }

    try {
      if (buffer.length > 24 && buffer[0] === 0x89 && buffer[1] === 0x50) {
        const width = buffer.readUInt32BE(16);
        const height = buffer.readUInt32BE(20);
        if (width > 0 && height > 0) return { width, height };
      }
    } catch (error: unknown) {
      this.logger.warn(
        'En-tête PNG illisible : les dimensions restent inconnues',
        error instanceof Error ? error.message : error,
      );
    }
    return null;
  }

  private async performImageOcr(buffer: Buffer): Promise<OcrResult> {
    // Garde-fou taille buffer ridicule (ex: 2x36 = souvent < 5Ko mais pas toujours fiable)
    if (!buffer || buffer.length < 256) {
      return this.ocrError(
        `Lecture impossible : image trop petite/corrompue (${buffer?.length ?? 0} octets) — scan illisible`,
      );
    }

    // Validation dimensions avant d'initialiser Tesseract (coûteux ~1-2s/worker)
    const dims = await this.validateImageSize(buffer);
    const dimensionError = this.validateOcrDimensions(dims);
    if (dimensionError) {
      return dimensionError;
    }

    try {
      const createWorker = await this.loadOcrWorkerFactory();
      if (!createWorker) return this.ocrError('OCR non disponible (tesseract.js non installé)');

      const processedBuffer = await this.preprocessImage(buffer);

      const { OEM } = await import('tesseract.js');
      const worker: OcrWorker = await createWorker('fra+eng', OEM.LSTM_ONLY, {
        logger: () => undefined,
      });
      const { data } = await worker.recognize(processedBuffer);
      await worker.terminate();

      const text = data?.text ?? '';
      const confidence = OcrService.estimateConfidence(data?.confidence, text);

      // Si Tesseract retourne vide sans erreur, c'est aussi une lecture impossible douce
      if (!text.trim()) {
        return this.ocrError(
          'Lecture impossible : aucun texte détecté dans l’image (scan vide, flou ou manuscrit illisible)',
        );
      }

      return {
        text: text.trim(),
        confidence: Math.min(1, Math.max(0, confidence)),
        method: 'ocr',
      };
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error);
      // Mapping erreur Leptonica en message métier FR
      if (/Image too small to scale/i.test(raw)) {
        return this.buildImageTooSmallResult(raw);
      }
      this.logger.warn(`Échec OCR: ${raw}`);
      return {
        text: '',
        confidence: 0,
        method: 'ocr',
        error: `Échec OCR: ${raw}`,
      };
    }
  }

  private buildImageTooSmallResult(raw: string): OcrResult {
    const sizeMatch = IMAGE_SIZE_ERROR_PATTERN.exec(raw);
    const dimsStr = sizeMatch ? sizeMatch[1] : '2×36';
    const minStr = sizeMatch ? sizeMatch[2] : '3';
    this.logger.warn(`OCR ignoré : ${raw} — image décorative`);
    return {
      text: '',
      confidence: 0,
      method: 'ocr',
      error: `Lecture impossible : image trop petite (${dimsStr} vs minimum ${minStr}px de large) — scan illisible ou fichier décoratif, ignorée`,
    };
  }

  private static estimateConfidence(confidence: number | undefined, text: string): number {
    if (typeof confidence === 'number') {
      return confidence / 100;
    }
    return text.length > 20 ? 0.85 : 0.5;
  }

  private ocrError(error: string): OcrResult {
    return { text: '', confidence: 0, method: 'ocr', error };
  }

  private validateOcrDimensions(dims: { width: number; height: number } | null): OcrResult | null {
    if (!dims) return null;
    const { width, height } = dims;
    if (width < 15 || height < 15 || width * height < 800) {
      this.logger.warn(
        `OCR ignoré : image décorative/trop petite ${width}×${height}, minimum ~15×15`,
      );
      return this.ocrError(
        `Lecture impossible : image trop petite (${width}×${height}, minimum 15×15) — scan illisible ou fichier décoratif, ignorée`,
      );
    }
    if (width < 3) {
      return this.ocrError(
        `Lecture impossible : image trop étroite (${width}×${height}, minimum 3px de large) — ${width}×${height} vs min width of 3`,
      );
    }
    return null;
  }

  private async loadOcrWorkerFactory(): Promise<CreateWorkerFn | null> {
    try {
      const tesseract = await import('tesseract.js');
      return tesseract.createWorker;
    } catch {
      this.logger.warn('tesseract.js non installé, OCR désactivé - utilisation du fallback');
      return null;
    }
  }

  private async preprocessImage(buffer: Buffer): Promise<Buffer> {
    try {
      const { default: sharp } = await import('sharp');
      return await sharp(buffer)
        .rotate()
        .grayscale()
        .normalize()
        .sharpen({ sigma: 1.2 })
        .toBuffer();
    } catch (error) {
      this.logger.warn(
        'Échec dans preprocessImage — poursuite en mode dégradé',
        error instanceof Error ? error.message : error,
      );
      // Pré-traitement impossible : on tente l'OCR sur l'image originale.
      return buffer;
    }
  }
}
