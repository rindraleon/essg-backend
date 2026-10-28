import { AdmissionFileType } from './entities/admission-file.entity';

const ARCHIVE_SLOT_SLUGS: Record<AdmissionFileType, string> = {
  [AdmissionFileType.DEMANDE_INSCRIPTION]: 'demande-inscription',
  [AdmissionFileType.BORDEREAU]: 'bordereau-versement',
  [AdmissionFileType.PHOTO_IDENTITE]: 'photo-identite',
  [AdmissionFileType.ACTE_ETAT_CIVIL]: 'acte-etat-civil',
  [AdmissionFileType.RELEVE_BAC]: 'releve-bac',
  [AdmissionFileType.ATTESTATION_BAC]: 'attestation-bac',
  [AdmissionFileType.DIPLOME_BAC]: 'diplome-bac',
  [AdmissionFileType.RELEVE_L3]: 'releve-l3',
  [AdmissionFileType.ATTESTATION_ETABLISSEMENT]: 'attestation-etablissement',
  [AdmissionFileType.CV]: 'cv',
  [AdmissionFileType.LETTRE]: 'lettre-motivation',
};

const UNKNOWN_SLOT_POSITION = 99;
const MAX_SEGMENT_LENGTH = 60;
const MAX_ENTRY_BASE_LENGTH = 100;

const ARCHIVE_SLOT_ORDER = Object.keys(ARCHIVE_SLOT_SLUGS) as AdmissionFileType[];

/** Transforme une valeur libre en segment ASCII sûr pour un nom de fichier. */
export function toArchiveSlug(value: string, maxLength = MAX_SEGMENT_LENGTH): string {
  const words = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  return words.join('-').slice(0, maxLength).replace(/-$/, '').toUpperCase();
}

export function buildAdmissionArchiveFilename(admission: {
  id: number;
  nom: string;
  prenom: string;
  annee: number;
}): string {
  const parts = [
    'admission',
    `ESSG-${admission.id}`,
    toArchiveSlug(admission.nom) || 'CANDIDAT',
    toArchiveSlug(admission.prenom),
    String(admission.annee),
  ].filter(Boolean);
  return `${parts.join('-')}.zip`;
}

export function archiveSlotPosition(type: AdmissionFileType): number {
  const index = ARCHIVE_SLOT_ORDER.indexOf(type);
  return index === -1 ? UNKNOWN_SLOT_POSITION : index + 1;
}

export function buildArchiveEntryNames(
  items: readonly { type: AdmissionFileType; extension: string }[],
): string[] {
  const used = new Set<string>();
  return items.map(({ type, extension }) => {
    const position = String(archiveSlotPosition(type)).padStart(2, '0');
    const slug = ARCHIVE_SLOT_SLUGS[type] ?? 'piece-jointe';
    const base = `${position}-${slug}`.slice(0, MAX_ENTRY_BASE_LENGTH);
    let candidate = `${base}.${extension}`;
    let suffix = 2;
    while (used.has(candidate.toLowerCase())) {
      candidate = `${base}-${suffix}.${extension}`;
      suffix += 1;
    }
    used.add(candidate.toLowerCase());
    return candidate;
  });
}

export function buildMissingFilesManifest(missingLabels: readonly string[]): string {
  return [
    'Pièces non incluses dans cette archive (introuvables dans le stockage) :',
    ...missingLabels.map((label) => `- ${label}`),
    '',
    "Veuillez vérifier le stockage ou contacter l'administrateur du site.",
    '',
  ].join('\r\n');
}
