import { DISPOSABLE_EMAIL_DOMAINS } from './disposable-domains.constant';
import disposableList from 'disposable-email-domains';
import wildcardList from 'disposable-email-domains/wildcard.json';

export const EMAIL_MAX_LENGTH = 50;
export const EMAIL_LOCAL_MAX_LENGTH = 64;
export const EMAIL_DOMAIN_MAX_LENGTH = 255;

const EMAIL_LOCAL_REGEX = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const EMAIL_DOMAIN_LABEL_REGEX = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/;
const EMAIL_TLD_REGEX = /^[A-Za-z]{2,}$/;

export const EMAIL_REGEX = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)*\.[A-Za-z]{2,}$/;

export const EMAIL_ERROR_MESSAGES = {
  required: 'Adresse e-mail obligatoire.',
  invalid: 'Adresse e-mail invalide.',
  tooLong: `L'adresse e-mail ne peut pas dépasser ${EMAIL_MAX_LENGTH} caractères.`,
  disposable: 'Le domaine de cette adresse est introuvable ou jetable. Utilisez une adresse e-mail valide.',
  undeliverable: 'Cette adresse e-mail ne semble pas pouvoir recevoir de messages.',
} as const;

export function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function getEmailDomain(email: string): string | null {
  const parts = normalizeEmail(email).split('@');
  return parts.length === 2 && parts[1] ? parts[1] : null;
}

export function isValidEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized || normalized.length > EMAIL_MAX_LENGTH) return false;
  const parts = normalized.split('@');
  if (parts.length !== 2) return false;

  const [local, domain] = parts;
  if (!local || local.length > EMAIL_LOCAL_MAX_LENGTH || !EMAIL_LOCAL_REGEX.test(local)) {
    return false;
  }
  if (!domain || domain.length > EMAIL_DOMAIN_MAX_LENGTH) return false;

  const labels = domain.split('.');
  if (labels.length < 2) return false;
  if (!EMAIL_TLD_REGEX.test(labels.at(-1) ?? '')) return false;
  return labels.every((label) => label.length <= 63 && EMAIL_DOMAIN_LABEL_REGEX.test(label));
}

const DISPOSABLE_DOMAIN_SET = new Set([
  ...DISPOSABLE_EMAIL_DOMAINS,
  ...disposableList.map((domain) => domain.toLowerCase()),
]);
const DISPOSABLE_WILDCARD_DOMAINS = wildcardList.map((domain) => domain.toLowerCase());

export interface DisposableDomainSource {
  isExactMatch(domain: string): boolean;
  isWildcardMatch(domain: string): boolean;
}

let extraSource: DisposableDomainSource | null = null;

export function registerDisposableDomainSource(source: DisposableDomainSource | null): void {
  extraSource = source;
}

function isKnownDisposableDomain(domain: string): boolean {
  return DISPOSABLE_DOMAIN_SET.has(domain) || (extraSource?.isExactMatch(domain) ?? false);
}

export function isDisposableEmail(email: string): boolean {
  const domain = getEmailDomain(email);
  if (!domain) return false;
  if (isKnownDisposableDomain(domain)) return true;
  if (
    DISPOSABLE_WILDCARD_DOMAINS.some(
      (suffix) => domain === suffix || domain.endsWith(`.${suffix}`),
    )
  ) {
    return true;
  }
  if (extraSource?.isWildcardMatch(domain)) return true;

  const labels = domain.split('.');
  for (let i = 1; i < labels.length - 1; i += 1) {
    if (isKnownDisposableDomain(labels.slice(i).join('.'))) return true;
  }
  return false;
}

export interface EmailSyntaxResult {
  valid: boolean;
  email: string;
  reason: string | null;
}

export function checkEmailSyntax(email: unknown): EmailSyntaxResult {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return { valid: false, email: normalized, reason: EMAIL_ERROR_MESSAGES.required };
  }
  if (normalized.length > EMAIL_MAX_LENGTH) {
    return { valid: false, email: normalized, reason: EMAIL_ERROR_MESSAGES.tooLong };
  }
  if (!isValidEmail(normalized)) {
    return { valid: false, email: normalized, reason: EMAIL_ERROR_MESSAGES.invalid };
  }
  if (isDisposableEmail(normalized)) {
    return { valid: false, email: normalized, reason: EMAIL_ERROR_MESSAGES.disposable };
  }
  return { valid: true, email: normalized, reason: null };
}
