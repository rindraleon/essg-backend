export const PASSWORD_RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

export const PASSWORD_RESET_TOKEN_BYTES = 32;

export const PASSWORD_RESET_TOKEN_SHA256_LENGTH = 64;

export const PASSWORD_RESET_MAX_REQUESTS_PER_HOUR = 3;

export const PASSWORD_RESET_GENERIC_MESSAGE =
  'Si cette adresse email correspond à un compte, un lien de réinitialisation vous sera envoyé.';

export const PASSWORD_RESET_LINK_PATH = '/reset-password';

export const DEFAULT_PASSWORD_MIN_LENGTH = 8;

export type ResetTokenStatus = 'valid' | 'expired' | 'used' | 'invalid';

export const RESET_TOKEN_ERROR_MESSAGES: Record<ResetTokenStatus, string> = {
  valid: 'Token valide',
  expired: 'Ce lien a expiré. Demandez un nouveau lien de réinitialisation.',
  used: 'Ce lien a déjà été utilisé. Demandez un nouveau lien de réinitialisation.',
  invalid: 'Ce lien est invalide. Demandez un nouveau lien de réinitialisation.',
};
