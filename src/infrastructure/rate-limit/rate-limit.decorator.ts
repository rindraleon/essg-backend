import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rateLimit';

export type RateLimitStrategy = 'ip' | 'ip-email';

export interface RateLimitOptions {
  scope: string;
  limit: number;
  windowSeconds: number;
  strategy?: RateLimitStrategy;
  message?: string;
}

export const RateLimit = (options: RateLimitOptions): MethodDecorator =>
  SetMetadata(RATE_LIMIT_KEY, options);

export const RATE_LIMITS = {
  login: {
    scope: 'auth-login',
    limit: 10,
    windowSeconds: 300,
    strategy: 'ip-email',
    message:
      'Trop de tentatives de connexion. Réessayez dans quelques minutes ou réinitialisez votre mot de passe.',
  },
  contact: {
    scope: 'contact',
    limit: 5,
    windowSeconds: 600,
    strategy: 'ip',
    message: 'Trop de messages envoyés. Merci de patienter quelques minutes avant de réessayer.',
  },
  admission: {
    scope: 'admission',
    limit: 3,
    windowSeconds: 3600,
    strategy: 'ip',
    message:
      'Trop de candidatures envoyées depuis cette connexion. Réessayez dans une heure ou contactez l’administration.',
  },
} as const satisfies Record<string, RateLimitOptions>;
