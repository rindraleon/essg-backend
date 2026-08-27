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

    this.logger.error(`HTTP ${statusCode}: ${message}`);

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
}
