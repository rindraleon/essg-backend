export function normalizeEmail(value?: string | null): string | null {
  const trimmed = value?.trim().toLowerCase();
  return trimmed || null;
}

export function normalizePhoneNumber(value?: string | null): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;
  const hadPlusPrefix = raw.startsWith('+');
  let digits = raw.replace(/\D+/g, '');
  if (!digits) return null;

  if (digits.startsWith('00')) digits = digits.slice(2);

  if (digits.startsWith('261')) {
    const rest = digits.slice(3);
    if (rest.length === 9 && !rest.startsWith('0')) return `+261${rest}`;
    if (rest.length === 10 && rest.startsWith('0')) return `+261${rest.slice(1)}`;
  }

  if (digits.length === 10 && digits.startsWith('0')) return `+261${digits.slice(1)}`;

  return hadPlusPrefix || digits.length > 10 ? `+${digits}` : digits;
}


export function phoneComparisonKey(value?: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 6) return null;
  return digits.slice(-9);
}
