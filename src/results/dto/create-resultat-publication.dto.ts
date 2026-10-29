import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export const RESULTAT_PUBLICATION_TYPES = ['excel', 'pdf'] as const;
export const RESULTAT_PUBLICATION_STATUSES = ['brouillon', 'publie', 'archive'] as const;
export const RESULTAT_CONSULTATION_MODES = ['public', 'protege'] as const;

export class CreateResultatPublicationDto {
  @IsString()
  @MaxLength(200)
  titre!: string;

  @IsIn(RESULTAT_PUBLICATION_TYPES, {
    message: 'Le type doit être « excel » ou « pdf ».',
  })
  type!: string;

  @IsString()
  @MaxLength(50)
  anneeScolaire!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  periode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  classeFormation?: string;

  @IsIn(RESULTAT_CONSULTATION_MODES, {
    message: 'Le mode de consultation doit être « public » ou « protege ».',
  })
  modeConsultation!: string;

  @IsOptional()
  @IsBoolean()
  autorisePublicationPublique?: boolean;
}

export class UpdateResultatPublicationDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  titre?: string;

  @IsOptional()
  @IsIn(RESULTAT_PUBLICATION_TYPES, {
    message: 'Le type doit être « excel » ou « pdf ».',
  })
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  anneeScolaire?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  periode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  classeFormation?: string;

  @IsOptional()
  @IsIn(RESULTAT_CONSULTATION_MODES, {
    message: 'Le mode de consultation doit être « public » ou « protege ».',
  })
  modeConsultation?: string;

  @IsOptional()
  @IsBoolean()
  autorisePublicationPublique?: boolean;

  @IsOptional()
  @IsIn(RESULTAT_PUBLICATION_STATUSES, {
    message: 'Le statut doit être « brouillon », « publie » ou « archive ».',
  })
  statutPublication?: string;
}

export class QueryResultatPublicationDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  anneeScolaire?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  periode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  classeFormation?: string;

  @IsOptional()
  @IsIn(RESULTAT_PUBLICATION_TYPES)
  type?: string;

  @IsOptional()
  @IsIn(RESULTAT_PUBLICATION_STATUSES)
  statutPublication?: string;

  @IsOptional()
  @IsIn(['admis', 'ajourne'])
  statutAcademique?: string;
}

export type ResultatImportPreviewRow = {
  numeroLigne: number;
  matricule: string | null;
  nom: string | null;
  prenom: string | null;
  classe: string | null;
  periode: string | null;
  notes: Record<string, unknown> | null;
  moyenne: number | null;
  statutAcademique: string | null;
  observation: string | null;
  valide: boolean;
  erreurs: string[];
  doublon: boolean;
};

export type ResultatImportPreview = {
  type: 'excel' | 'pdf' | 'inconnu';
  feuille: string | null;
  colonnes: string[];
  lignes: ResultatImportPreviewRow[];
  totalLignes: number;
  lignesValides: number;
  lignesInvalides: number;
  doublons: number;
  message: string;
};
