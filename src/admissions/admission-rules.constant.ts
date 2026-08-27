export const ADMISSION_LEVELS = ['licence', 'master'] as const;
export const BAC_TYPES = ['general', 'technologique'] as const;
export const BAC_CATEGORIES = ['scientifique', 'litteraire', 'technologique', 'ose'] as const;

export type AdmissionLevel = (typeof ADMISSION_LEVELS)[number];
export type BacType = (typeof BAC_TYPES)[number];
export type BacCategory = (typeof BAC_CATEGORIES)[number];

const BAC_SERIES: Record<BacType, Record<string, BacCategory>> = {
  general: {
    a1: 'litteraire',
    a2: 'litteraire',
    ose: 'ose',
    c: 'scientifique',
    d: 'scientifique',
    l: 'litteraire',
    s: 'scientifique',
  },
  technologique: {
    tgc: 'technologique',
    tgi: 'technologique',
    tter: 'technologique',
  },
};

const MENTIONS = [
  {
    id: 'geoinformatique',
    parcours: ['geomatique-teledetection'],
    categories: ['scientifique', 'technologique', 'ose'],
  },
  {
    id: 'geomatique-applications',
    parcours: [
      'geomatique-geologie-economique',
      'geomatique-agriculture-durable',
      'geomatique-ecosystemes',
    ],
    categories: ['scientifique', 'technologique', 'ose'],
  },
  {
    id: 'geomatique-management',
    parcours: ['geomatique-communication-marketing', 'geomatique-genre-inclusion-developpement'],
    categories: ['scientifique', 'litteraire', 'technologique', 'ose'],
  },
] as const;

export function resolveBacCategory(type: string, serie: string): BacCategory | null {
  const normalizedType = type.trim().toLowerCase() as BacType;
  const normalizedSerie = serie.trim().toLowerCase();
  return BAC_SERIES[normalizedType]?.[normalizedSerie] ?? null;
}

export function isAdmissionProgramEligible(
  level: string,
  category: string,
  mention: string,
  parcours: string,
): boolean {
  const normalizedLevel = level.trim().toLowerCase();
  if (!ADMISSION_LEVELS.includes(normalizedLevel as AdmissionLevel)) return false;
  const rule = MENTIONS.find((item) => item.id === mention.trim().toLowerCase());
  if (!rule) return false;
  return (
    rule.categories.includes(category.trim().toLowerCase() as never) &&
    rule.parcours.includes(parcours.trim().toLowerCase() as never)
  );
}
