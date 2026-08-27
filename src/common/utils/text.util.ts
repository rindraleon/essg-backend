export function toUpperCase(value: string): string {
  return value.trim().toLocaleUpperCase('fr-FR');
}

export function capitalize(value: string): string {
  const trimmed = value.trim();
  return trimmed ? trimmed.charAt(0).toLocaleUpperCase('fr-FR') + trimmed.slice(1) : trimmed;
}

export function capitalizeWords(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('fr-FR')
    .replace(
      /(^|[\s'’-])(\p{L})/gu,
      (_, separator, letter: string) => `${separator}${letter.toLocaleUpperCase('fr-FR')}`,
    );
}

export function capitalizeArray(values?: string[] | null): string[] {
  return (values ?? []).map((value) => capitalize(value ?? ''));
}

export function slugify(value: string): string {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-');
  return normalized.split('-').filter(Boolean).join('-');
}
