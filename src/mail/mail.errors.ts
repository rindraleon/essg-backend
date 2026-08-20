import { BadRequestException, HttpException, ServiceUnavailableException } from '@nestjs/common';

export const MAIL_ERROR = {
  INVALID_ADDRESS: 'Adresse email invalide',
  SMTP_CONNECTION: 'Erreur de connexion au serveur SMTP',
  SEND_FAILED: "Impossible d'envoyer l'email",
} as const;

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function toMailHttpException(error: unknown): HttpException {
  if (error instanceof HttpException) return error;

  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  const responseCode =
    typeof error === 'object' && error && 'responseCode' in error
      ? Number((error as { responseCode?: number }).responseCode)
      : 0;
  const message = error instanceof Error ? error.message : String(error);
  const haystack = `${code} ${responseCode} ${message}`.toLowerCase();

  if (
    responseCode === 550 ||
    responseCode === 551 ||
    responseCode === 553 ||
    /recipient|invalid address|unknown user|mailbox unavailable/.test(haystack)
  ) {
    return new BadRequestException(MAIL_ERROR.INVALID_ADDRESS);
  }

  if (
    /econnrefused|etimedout|enotfound|ehostunreach|esocket|eauth|greeting|connection|authentication/.test(
      haystack,
    )
  ) {
    return new ServiceUnavailableException(MAIL_ERROR.SMTP_CONNECTION);
  }

  return new ServiceUnavailableException(MAIL_ERROR.SEND_FAILED);
}

export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#39;');
}
