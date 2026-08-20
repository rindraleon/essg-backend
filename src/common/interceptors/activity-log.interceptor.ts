import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ActivityLogDescriptionService } from 'src/activity-logs/activity-log-description.service';
import { ActivityLogService } from 'src/activity-logs/activity-log.service';


const LOGGED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const EXCLUDED_MODULES = new Set(['auth']);

interface AuthUser {
  userId: number;
  role: string;
  email: string;
  nom: string;
  prenom: string;
}

@Injectable()
export class ActivityLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ActivityLogInterceptor.name);

  constructor(
    private readonly activityLogService: ActivityLogService,
    private readonly descriptionService: ActivityLogDescriptionService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<
      Request & { user?: AuthUser; params: Record<string, string> }
    >();
    const response = http.getResponse<Response>();
    const method = request.method;

    if (!LOGGED_METHODS.has(method)) {
      return next.handle();
    }

    const module = this.resolveModule(request.path);
    if (EXCLUDED_MODULES.has(module)) {
      return next.handle();
    }

    const user = request.user ?? null;
    const segments = this.pathSegments(request.path);
    const action = this.descriptionService.resolveAction(method, segments);
    const metadata = this.buildMetadata(module, request);
    const endpoint = request.originalUrl;
    const ipAddress = this.resolveIp(request);

    return next.handle().pipe(
      tap(() => {
        const statusCode = response.statusCode;
        void this.safePersist({
          userId: user?.userId ?? null,
          userName: this.resolveUserName(user),
          action,
          method,
          endpoint,
          module,
          statusCode,
          success: statusCode < 400,
          ipAddress,
          metadata,
        });
      }),
      catchError((error: unknown) => {
        const statusCode = error instanceof HttpException ? error.getStatus() : 500;
        void this.safePersist({
          userId: user?.userId ?? null,
          userName: this.resolveUserName(user),
          action,
          method,
          endpoint,
          module,
          statusCode,
          success: false,
          ipAddress,
          metadata,
        });
        return throwError(() => error);
      }),
    );
  }

  private resolveModule(path: string): string {
    const normalized = path.split('?')[0].replace(/^\/+/, '');
    const first = normalized.split('/')[0];
    return first ?? '';
  }

  private pathSegments(path: string): string[] {
    return path
      .split('?')[0]
      .split('/')
      .filter((segment) => segment.length > 0);
  }

  private buildMetadata(module: string, request: Request): Record<string, unknown> {
    const metadata: Record<string, unknown> = {
      entityType: this.descriptionService.entityType(module),
    };
    const body = request.body as Record<string, unknown> | undefined;
    const rawId = (request.params as Record<string, string> | undefined)?.id;
    if (rawId) {
      const numericId = Number(rawId);
      metadata.entityId = Number.isNaN(numericId) ? rawId : numericId;
    }
    if (module === 'admissions' && body?.statut) {
      metadata.status = body.statut;
    }
    return metadata;
  }

  /** Construit « Prénom Nom » pour l'affichage métier du journal. */
  private resolveUserName(user: AuthUser | null): string | null {
    if (!user) return null;
    const parts = [user.prenom, user.nom].filter(
      (part): part is string => typeof part === 'string' && part.trim().length > 0,
    );
    if (parts.length > 0) return parts.join(' ').trim();
    return user.email ?? null;
  }

  private resolveIp(request: Request): string | null {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0].trim();
    }
    return request.ip || null;
  }

  private async safePersist(
    data: Omit<Parameters<ActivityLogService['create']>[0], 'description'>,
  ): Promise<void> {
    try {
      const description = this.descriptionService.describe({
        module: data.module,
        method: data.method,
        action: data.action,
        endpoint: data.endpoint,
        metadata: data.metadata,
      });
      await this.activityLogService.create({
        ...data,
        description,
      });
    } catch (error) {
      this.logger.error(
        "Échec de l'enregistrement de l'ActivityLog",
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
