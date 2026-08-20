import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { QueryFailedError } from 'typeorm';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const { statusCode, message } = this.resolveError(exception);

    this.logger.error(
      'Unhandled exception',
      exception instanceof Error ? exception.stack : String(exception),
    );

    response.status(statusCode).json({
      statusCode,
      message,
      data: null,
    });
  }

  private resolveError(exception: unknown): { statusCode: number; message: string } {
    if (exception instanceof QueryFailedError) {
      const code = (exception.driverError as { code?: string } | undefined)?.code;
      if (code === '23505') {
        return {
          statusCode: HttpStatus.CONFLICT,
          message: 'Cette valeur existe déjà. Vérifiez les champs uniques (slug, email…).',
        };
      }
      if (code === '23503') {
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Référence invalide : une ressource liée est introuvable.',
        };
      }
      if (code === '23502') {
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Un champ obligatoire est manquant.',
        };
      }
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'La requête n’a pas pu être enregistrée. Vérifiez les données saisies.',
      };
    }

    if (exception instanceof Error && /ECONNREFUSED|ENOTFOUND|ETIMEDOUT/.test(exception.message)) {
      return {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Le serveur de données est inaccessible. Réessayez dans un instant.',
      };
    }

    const isProduction = process.env.NODE_ENV === 'production';
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message:
        isProduction || !(exception instanceof Error)
          ? 'Erreur interne du serveur'
          : exception.message,
    };
  }
}
