export const ILIKE_ESCAPE = String.raw`ESCAPE '\'`;

export function escapeIlike(value: string): string {
  return value.replaceAll(/[\\%_]/g, String.raw`\$&`);
}

export function buildIlikeTerm(value: string): string {
  return `%${escapeIlike(value.trim())}%`;
}

export function sanitizeSortField(
  sortBy: string | undefined,
  allowed: readonly string[],
): string | undefined {
  if (!sortBy) {
    return undefined;
  }
  return allowed.includes(sortBy) ? sortBy : undefined;
}
