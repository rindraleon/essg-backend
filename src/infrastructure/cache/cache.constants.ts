export const CACHE_NAMESPACE = 'essg';

export const CACHE_TTL = {
  SHORT: 60,
  MEDIUM: 300,
  LONG: 1800,
} as const;

export const CACHE_RESOURCE = {
  projects: 'projects',
  formations: 'formations',
  news: 'news',
  partners: 'partners',
  ressourcesHumaines: 'ressources-humaines',
  settings: 'settings',
  dashboard: 'dashboard',
} as const;

export type CacheResource = (typeof CACHE_RESOURCE)[keyof typeof CACHE_RESOURCE];

export function buildCacheKey(
  resource: string,
  segment: string,
  params?: Record<string, unknown> | string | number,
): string {
  const base = `${CACHE_NAMESPACE}:${resource}:${segment}`;
  if (params === undefined) return base;
  if (typeof params === 'string' || typeof params === 'number') {
    return `${base}:${normalizeValue(params)}`;
  }
  const serialized = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => [key, normalizeValue(value)] as const)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join(':');
  return serialized ? `${base}:${serialized}` : base;
}

export function buildResourcePrefix(resource: string): string {
  return `${CACHE_NAMESPACE}:${resource}:`;
}

function normalizeValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(normalizeValue).join(',');
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    return value.trim().toLowerCase().replace(/\s+/g, '-').replaceAll(':', '_');
  }
  return String(value);
}
