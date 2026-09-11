import { AdmissionFileType } from '../../entities/admission-file.entity';

export enum DocumentCategory {
  SCOLAIRE = 'scolaire',
  BORDEREAU = 'bordereau',
  AUTRE = 'autre',
}

export interface ClassifiedDocument {
  fileId: number;
  type: AdmissionFileType;
  category: DocumentCategory;
  pertinence: string[];
}

const SCOLAIRE_TYPES = new Set<AdmissionFileType>([
  AdmissionFileType.RELEVE_BAC,
  AdmissionFileType.ATTESTATION_BAC,
  AdmissionFileType.DIPLOME_BAC,
  AdmissionFileType.RELEVE_L3,
  AdmissionFileType.ATTESTATION_ETABLISSEMENT,
]);

const BORDEREAU_TYPES = new Set<AdmissionFileType>([AdmissionFileType.BORDEREAU]);

export function classifyDocuments(
  files: Array<{ id: number; type: AdmissionFileType }>,
): ClassifiedDocument[] {
  return files.map((f) => {
    let category = DocumentCategory.AUTRE;
    let pertinence: string[] = [];
    if (SCOLAIRE_TYPES.has(f.type)) {
      category = DocumentCategory.SCOLAIRE;
      pertinence = ['nom', 'prenom', 'numeroBac', 'centreExamen'];
    } else if (BORDEREAU_TYPES.has(f.type)) {
      category = DocumentCategory.BORDEREAU;
      pertinence = ['bordereau'];
    }
    return { fileId: f.id, type: f.type, category, pertinence };
  });
}

export function getRelevantFilesForField(
  classified: ClassifiedDocument[],
  field: string,
): ClassifiedDocument[] {
  return classified.filter((c) => c.pertinence.includes(field));
}

export function getScolaireFiles(classified: ClassifiedDocument[]): ClassifiedDocument[] {
  return classified.filter((c) => c.category === DocumentCategory.SCOLAIRE);
}

export function getBordereauFiles(classified: ClassifiedDocument[]): ClassifiedDocument[] {
  return classified.filter((c) => c.category === DocumentCategory.BORDEREAU);
}
