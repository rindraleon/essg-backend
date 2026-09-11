import type { Response } from 'express';

/** Nom du cookie HttpOnly portant le refresh token (émis par le serveur uniquement). */
export const REFRESH_COOKIE_NAME = 'refresh_token';

export function readRefreshTokenFromCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== REFRESH_COOKIE_NAME) continue;
    const value = part.slice(separator + 1).trim();
    if (!value) return null;
    try {
      return decodeURIComponent(value);
    } catch (error) {
      console.warn(
        'Échec dans readRefreshTokenFromCookie — poursuite en mode dégradé',
        error instanceof Error ? error.message : error,
      );
      return value;
    }
  }
  return null;
}

export function setRefreshTokenCookie(
  res: Response,
  refreshToken: string,
  ttlMs: number,
  secure: boolean,
): void {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/auth',
    maxAge: ttlMs,
  });
}

/** Efface le cookie de refresh token à la déconnexion. */
export function clearRefreshTokenCookie(res: Response, secure: boolean): void {
  res.cookie(REFRESH_COOKIE_NAME, '', {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/auth',
    maxAge: 0,
  });
}
