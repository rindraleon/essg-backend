import { Injectable, Logger } from '@nestjs/common';
import { OcrService } from './ocr.service';

export interface ExtractionResult {
  text: string;
  method: 'native' | 'ocr' | 'none';
  confidence: number;
  error?: string;
  pages?: number;
}

@Injectable()
export class TextExtractionService {
  private readonly logger = new Logger(TextExtractionService.name);

  constructor(private readonly ocrService: OcrService) {}

  async extractText(buffer: Buffer, mimetype: string, filename: string): Promise<ExtractionResult> {
    const lowerMime = mimetype.toLowerCase();
    const lowerName = filename.toLowerCase();

    const isPdf = lowerMime === 'application/pdf' || lowerName.endsWith('.pdf');
    const isImage = lowerMime.startsWith('image/') || /\.(jpe?g|png)$/i.test(lowerName);

    if (isPdf) {
      const native = await this.extractPdfNative(buffer);
      if (native.text && native.text.trim().length > 50) {
        this.logger.log(`PDF native extraction succeeded: ${native.text.length} chars`);
        return { text: native.text, method: 'native', confidence: 0.95, pages: native.pages };
      }
      // Si texte natif insuffisant, tentative OCR
      this.logger.log(
        `PDF native extraction insufficient (${native.text.length} chars), trying OCR fallback`,
      );
      const ocr = await this.ocrService.extractWithOcr(buffer, 'application/pdf');
      if (ocr.text && ocr.text.length > 20) {
        return { text: ocr.text, method: 'ocr', confidence: ocr.confidence };
      }
      // Retourner quand même le texte natif s'il existe, même court
      if (native.text && native.text.trim().length > 0) {
        return {
          text: native.text,
          method: 'native',
          confidence: 0.7,
          pages: native.pages,
          error: ocr.error,
        };
      }
      return {
        text: '',
        method: 'none',
        confidence: 0,
        error: native.error || ocr.error || 'Aucun texte extractible du PDF',
      };
    }

    if (isImage) {
      // Pour les images, directement OCR
      const ocr = await this.ocrService.extractWithOcr(buffer, lowerMime || 'image/jpeg');
      if (ocr.text) {
        return { text: ocr.text, method: 'ocr', confidence: ocr.confidence };
      }
      return {
        text: '',
        method: 'none',
        confidence: 0,
        error: ocr.error || 'Texte non détecté dans l’image',
      };
    }

    // Type inconnu : tentative d'extraction native si le buffer contient du texte lisible
    const asText = buffer.toString('utf-8');
    const printable = asText.replace(/[^\x20-\x7E\xC0-\xFF\n\r\t]/g, '').trim();
    if (printable.length > 100 && printable.split(/\s+/).length > 10) {
      return { text: printable.slice(0, 10000), method: 'native', confidence: 0.6 };
    }

    return {
      text: '',
      method: 'none',
      confidence: 0,
      error: `Type de fichier non supporté: ${mimetype}`,
    };
  }

  private async extractPdfNative(
    buffer: Buffer,
  ): Promise<{ text: string; pages?: number; error?: string }> {
    try {
      // Import dynamique pour éviter dépendance dure au chargement du module
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        const result = await parser.getText();
        const text = result?.text ?? '';
        const pages = typeof result?.total === 'number' ? result.total : undefined;
        return { text: text.trim(), pages };
      } finally {
        await parser.destroy();
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (/Cannot find module|Cannot find package/i.test(msg)) {
        return { text: '', error: 'pdf-parse non installé' };
      }
      this.logger.warn(`Échec extraction PDF native: ${msg}`);
      return { text: '', error: `Échec extraction PDF: ${msg}` };
    }
  }
}
