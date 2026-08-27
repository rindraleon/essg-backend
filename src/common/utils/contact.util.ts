/** Met l'email en minuscules et supprime les espaces superflus. */
export function normalizeEmail(value?: string | null): string | null {
  const trimmed = value?.trim().toLowerCase();
  return trimmed || null;
}

export function normalizePhoneNumber(value?: string | null): string | null {
  const digits = (value ?? '').replace(/\D+/g, '');
  if (!digits) return null;
  if (digits.startsWith('00261')) return `0${digits.slice(5)}`;
  if (digits.startsWith('261') && digits.length === 12) return `0${digits.slice(3)}`;
  return digits;
}
