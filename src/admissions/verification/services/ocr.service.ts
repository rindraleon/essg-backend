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

    // Fallback: analyse manuelle en-tête PNG
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

    // Fallback: analyse manuelle en-tête JPEG (SOF0 marker)
    try {
      if (buffer.length > 2 && buffer[0] === 0xFF && buffer[1] === 0xD8) {
        let offset = 2;
        while (offset < buffer.length - 9) {
          if (buffer[offset] !== 0xFF) break;
          const marker = buffer[offset + 1];
          const segmentLength = buffer.readUInt16BE(offset + 2);
          // SOF0 (0xC0) ou SOF2 (0xC2) contiennent les dimensions
          if (marker === 0xC0 || marker === 0xC2) {
            const height = buffer.readUInt16BE(offset + 5);
            const width = buffer.readUInt16BE(offset + 7);
            if (width > 0 && height > 0) return { width, height };
          }
          offset += 2 + segmentLength;
        }
      }
    } catch (error: unknown) {
      this.logger.warn(
        'En-tête JPEG illisible : les dimensions restent inconnues',
        error instanceof Error ? error.message : error,
      );
    }

    // Si on ne peut pas déterminer les dimensions, rejeter par sécurité
    this.logger.warn('Dimensions de l\'image indeterminables — rejection par sécurité');
    return { width: 0, height: 0 };
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

      // Re-vérifier les dimensions après pré-traitement (rotation possible)
      const processedDims = await this.validateImageSize(processedBuffer);
      const postProcessError = this.validateOcrDimensions(processedDims);
      if (postProcessError) {
        return postProcessError;
      }

      const { OEM } = await import('tesseract.js');
      const worker: OcrWorker = await createWorker('fra+eng', OEM.LSTM_ONLY, {
        logger: () => undefined,
      });
      let data;
      try {
        const result = await worker.recognize(processedBuffer);
        data = result.data;
      } finally {
        await worker.terminate();
      }

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
      // Mapping erreur Leptonica en message métier FR (supprimer le bruit Tesseract)
      if (/Image too small to scale/i.test(raw)) {
        return this.buildImageTooSmallResult(raw);
      }
      // Supprimer les messages internes de Tesseract/Leptonica du log
      if (/Leptonica|tesseract|Tesseract|lstmrecognizer/i.test(raw)) {
        return this.ocrError('Lecture impossible : erreur interne du moteur OCR — image probablement illisible ou corrompue');
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
    const dimsStr = sizeMatch ? sizeMatch[1] : 'dimensions inconnues';
    const minStr = sizeMatch ? sizeMatch[2] : '3';
    this.logger.log(`Image trop petite pour OCR (${dimsStr}) — ignorée gracieusement`);
    return {
      text: '',
      confidence: 0,
      method: 'ocr',
      error: `Lecture impossible : image trop petite (${dimsStr}, minimum ${minStr}px) — fichier décoratif ou icône, ignoré`,
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
    if (!dims || dims.width === 0 || dims.height === 0) {
      return this.ocrError(
        'Lecture impossible : dimensions de l\'image indeterminables ou nulles — fichier corrompu ou décoratif',
      );
    }
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
    } catch (error: unknown) {
      this.logger.warn(
        'tesseract.js non installé, OCR désactivé - utilisation du fallback',
        error instanceof Error ? error.message : error,
      );
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
