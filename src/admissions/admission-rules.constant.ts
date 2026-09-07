export const ADMISSION_LEVELS = ['licence', 'master'] as const;
export const BAC_TYPES = ['general', 'technologique'] as const;
export const BAC_CATEGORIES = ['scientifique', 'litteraire', 'technologique', 'ose'] as const;

export type AdmissionLevel = (typeof ADMISSION_LEVELS)[number];
export type BacType = (typeof BAC_TYPES)[number];
export type BacCategory = (typeof BAC_CATEGORIES)[number];

export const ADMISSION_SOURCES = [
  'soifee',
  'evenement-universite',
  'radio',
  'salon-tana',
  'recommandation',
] as const;

export type AdmissionSource = (typeof ADMISSION_SOURCES)[number];

export const ADMISSION_SOURCE_LABELS: Record<AdmissionSource, string> = {
  soifee: 'SOIFEE',
  'evenement-universite': 'Évènement université',
  radio: 'Radio',
  'salon-tana': 'Salon Tana',
  recommandation: 'Recommandation',
};

export const ADMISSION_GENRES = ['feminin', 'masculin', 'autre'] as const;
export type AdmissionGenre = (typeof ADMISSION_GENRES)[number];

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
    taef: 'technologique',
    tter: 'technologique',
  },
};

const SERIES_GROUPS = {
  scientifiqueTechnique: ['c', 'd', 's', 'tgc', 'tgi'],

  scientifiqueAgricole: ['c', 'd', 's', 'taef'],

  toutesSeries: ['a1', 'a2', 'c', 'd', 'l', 's', 'ose', 'tgc', 'tgi', 'taef', 'tter'],
} as const;

const MENTIONS = [
  {
    id: 'geoinformatique',
    parcours: {
      'geomatique-teledetection': SERIES_GROUPS.scientifiqueTechnique,
    },
  },
  {
    id: 'geomatique-applications',
    parcours: {
      'geomatique-geologie-economique': SERIES_GROUPS.scientifiqueTechnique,
      'geomatique-agriculture-durable': SERIES_GROUPS.scientifiqueAgricole,
      'geomatique-ecosystemes': SERIES_GROUPS.scientifiqueTechnique,
    },
  },
  {
    id: 'geomatique-management',
    parcours: {
      'geomatique-communication-marketing': SERIES_GROUPS.toutesSeries,
      'geomatique-genre-inclusion-developpement': SERIES_GROUPS.toutesSeries,
    },
  },
] as const;

export function resolveBacCategory(type: string, serie: string): BacCategory | null {
  const normalizedType = type.trim().toLowerCase() as BacType;
  const normalizedSerie = serie.trim().toLowerCase();
  return BAC_SERIES[normalizedType]?.[normalizedSerie] ?? null;
}

export function isAdmissionProgramEligible(
  level: string,
  serie: string,
  mention: string,
  parcours: string,
): boolean {
  const normalizedLevel = level.trim().toLowerCase();
  if (!ADMISSION_LEVELS.includes(normalizedLevel as AdmissionLevel)) return false;
  const rule = MENTIONS.find((item) => item.id === mention.trim().toLowerCase());
  if (!rule) return false;
  const allowedSeries = (rule.parcours as Record<string, readonly string[]>)[
    parcours.trim().toLowerCase()
  ];
  if (!allowedSeries) return false;
  return allowedSeries.includes(serie.trim().toLowerCase());
}
