import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  API_SIGNATURE,
  API_SIGNATURE_HEADER,
  API_VERSION,
  API_VERSION_HEADER,
} from '../constants/api.constants';
import { isScannerProbePath } from '../constants/scanner.constants';


interface ExceptionBody {
  message?: string | string[];
  error?: string;
}

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const statusCode = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    let message = 'Une erreur est survenue';

    if (statusCode === Number(HttpStatus.PAYLOAD_TOO_LARGE)) {
      message = 'Fichier trop volumineux : 5 Mo maximum pour une image.';
    } else if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (exceptionResponse && typeof exceptionResponse === 'object') {
      const body = exceptionResponse as ExceptionBody;
      if (Array.isArray(body.message)) {
        message = body.message.join(', ');
      } else if (typeof body.message === 'string') {
        message = body.message;
      }
    }

    this.logException(statusCode, message, request);

    response.setHeader(API_SIGNATURE_HEADER, API_SIGNATURE);
    response.setHeader(API_VERSION_HEADER, API_VERSION);
    response.status(statusCode).json({
      statusCode,
      message,
      data: null,
      signature: API_SIGNATURE,
      timestamp: new Date().toISOString(),
      path: request?.originalUrl ?? request?.url,
    });
  }

  private logException(statusCode: number, message: string, request?: Request): void {
    const method = request?.method ?? 'UNKNOWN';
    const url = request?.originalUrl ?? request?.url ?? '-';

    // 1. Scanner / bruit navigateur → aucun log d'erreur, déjà géré par ScannerGuardMiddleware
    if (isScannerProbePath(url)) {
      return;
    }

    // 2. Cas normal : refresh token absent/expiré après rechargement page
    // Ne doit jamais apparaître comme ERROR en prod
    if (
      statusCode === HttpStatus.UNAUTHORIZED &&
      url.includes('/auth/refresh')
    ) {
      this.logger.debug(`HTTP 401 refresh sans cookie — ${method} ${url} — ${message}`);
      return;
    }

    // 3. Erreurs serveur → error
    if (statusCode >= Number(HttpStatus.INTERNAL_SERVER_ERROR)) {
      this.logger.error(`HTTP ${statusCode} ${method} ${url} — ${message}`);
      return;
    }

    // 4. Rate limit → warn
    if (statusCode === Number(HttpStatus.TOO_MANY_REQUESTS)) {
      this.logger.warn(`HTTP ${statusCode} ${method} ${url} — ${message}`);
      return;
    }

    // 5. Tout le reste 4xx → debug (client en faute, pas le backend)
    this.logger.debug(`HTTP ${statusCode} ${method} ${url} — ${message}`);
  }
}
