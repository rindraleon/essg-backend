import type { Response } from 'express';

/** Nom du cookie HttpOnly portant le refresh token */
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
    } catch {
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
    sameSite: secure ? 'none' : 'lax',
    path: '/',
    maxAge: ttlMs,
  });
}

export function clearRefreshTokenCookie(res: Response, secure: boolean): void {
  res.cookie(REFRESH_COOKIE_NAME, '', {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    path: '/',
    maxAge: 0,
  });
}
