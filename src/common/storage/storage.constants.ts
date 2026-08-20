export const STORAGE_PREFIXES = {
  images: 'images',
  documents: 'documents',
  admissions: 'admissions',
  admissionsCv: 'admissions/cv',
  admissionsLettres: 'admissions/lettres',
  projects: 'projects',
  news: 'news',
  formations: 'formations',
  partners: 'partners',
  avatars: 'avatars',
  staff: 'staff',
} as const;

export type StoragePrefix = (typeof STORAGE_PREFIXES)[keyof typeof STORAGE_PREFIXES];

export const PRIVATE_OBJECT_PREFIXES = ['admissions/'] as const;

export const MEDIA_ROUTE_PREFIX = 'media';

export function isPrivateObjectKey(objectName: string): boolean {
  const normalized = objectName.replace(/^\/+/, '');
  return PRIVATE_OBJECT_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function normalizeStoragePrefix(value?: string): string {
  if (!value) return STORAGE_PREFIXES.images;
  const cleaned = value.replace(/^\/+|\/+$/g, '');
  const allowed = new Set<string>(Object.values(STORAGE_PREFIXES));
  if (allowed.has(cleaned)) return cleaned;
  const mapped = cleaned.toLowerCase();
  if (allowed.has(mapped)) return mapped;
  return STORAGE_PREFIXES.images;
}
