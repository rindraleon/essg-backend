export interface FormationMention {
  code: string;
  label: string;
  titres: string[];
}

export const FORMATION_MENTIONS: readonly FormationMention[] = [
  {
    code: 'geomatique-et-applications',
    label: 'GÉOMATIQUE ET APPLICATIONS',
    titres: [
      'Géomatique et agriculture durable',
      'Géomatique et santé',
      'Géomatique, ressources naturelles et assainissement',
      'Cartographie numérique et développement',
    ],
  },
  {
    code: 'geomatique-et-management',
    label: 'GÉOMATIQUE ET MANAGEMENT',
    titres: [
      "Géomatique pour l'équité-genre",
      'Géomatique et économie',
      'Géomatique et bonne gouvernance',
      'Géomatique, communication et marketing',
      'Géo-entreprenariat',
    ],
  },
  {
    code: 'informatique-et-donnees-spatiales',
    label: 'INFORMATIQUE ET DONNÉES SPATIALES',
    titres: [
      "Système d'Information Géomatique et Décision",
      "Ingénierie Géospatiale et Technologie d'Informations",
      'Géomatique et Intelligence Artificielle',
      'Télédétection et SIG',
    ],
  },
] as const;

export const MENTION_CODES: readonly string[] = FORMATION_MENTIONS.map((m) => m.code);

export const MENTION_LABELS: readonly string[] = FORMATION_MENTIONS.map((m) => m.label);

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function findMention(value?: string | null): FormationMention | undefined {
  if (!value) return undefined;
  const needle = normalize(value);
  return FORMATION_MENTIONS.find(
    (mention) => normalize(mention.code) === needle || normalize(mention.label) === needle,
  );
}

export function findMentionByTitre(titre?: string | null): FormationMention | undefined {
  if (!titre) return undefined;
  const needle = normalize(titre);
  return FORMATION_MENTIONS.find((mention) =>
    mention.titres.some((item) => normalize(item) === needle),
  );
}

export function isTitreInMention(mentionValue: string, titre: string): boolean {
  const mention = findMention(mentionValue);
  if (!mention) return false;
  const needle = normalize(titre);
  return mention.titres.some((item) => normalize(item) === needle);
}

export function canonicalMentionLabel(value: string): string {
  return findMention(value)?.label ?? value;
}

export function canonicalTitre(titre: string): string {
  const needle = normalize(titre);
  for (const mention of FORMATION_MENTIONS) {
    const match = mention.titres.find((item) => normalize(item) === needle);
    if (match) return match;
  }
  return titre;
}
