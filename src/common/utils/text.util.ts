export function toUpperCase(value: string): string {
  return value.trim().toLocaleUpperCase('fr-FR');
}

export function capitalize(value: string): string {
  const trimmed = value.trim();
  return trimmed ? trimmed.charAt(0).toLocaleUpperCase('fr-FR') + trimmed.slice(1) : trimmed;
}

export function capitalizeArray(values?: string[] | null): string[] {
  return (values ?? []).map((value) => capitalize(value ?? ''));
}

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}
