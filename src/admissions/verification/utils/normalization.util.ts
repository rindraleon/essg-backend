export function removeAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function normalizeText(value: string | null | undefined): string {
  if (!value) return '';
  return removeAccents(value)
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^A-Z0-9\s\-'’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeDigits(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/\D/g, '');
}

export function normalizeBordereau(value: string | null | undefined): string {
  if (!value) return '';
  return removeAccents(value)
    .toUpperCase()
    .trim()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9\-_/.]/g, '');
}

export function normalizeCentre(value: string | null | undefined): string {
  if (!value) return '';
  return removeAccents(value)
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^A-Z0-9\s\-']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(normalized: string): string[] {
  if (!normalized) return [];
  return normalized.split(/[\s\-'’]+/).filter(Boolean);
}

export function tokenSet(normalized: string): Set<string> {
  return new Set(tokenize(normalized));
}

export function sortedTokens(normalized: string): string {
  return tokenize(normalized)
    .sort((a, b) => a.localeCompare(b))
    .join(' ');
}

export function normalizeForSearch(value: string): string {
  return normalizeText(value);
}
