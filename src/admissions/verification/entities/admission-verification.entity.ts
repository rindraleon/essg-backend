import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Admission } from '../../entities/admission.entity';

export enum VerificationGlobalStatus {
  CONFORME = 'conforme',
  VERIFICATION_MANUELLE = 'verification_manuelle',
  INCOMPATIBLE = 'incompatible',
  IMPOSSIBLE = 'impossible',
}

export enum VerificationFieldStatus {
  CONFORME = 'conforme',
  A_VERIFIER = 'a_verifier',
  NON_CONFORME = 'non_conforme',
  NON_DETECTE = 'non_detecte',
}

export interface VerificationFieldResult {
  champ:
    | 'nom'
    | 'prenom'
    | 'numeroBac'
    | 'centreExamen'
    | 'bordereau'
    | (string & Record<never, never>);
  label: string;
  valeurSaisie: string | null;
  valeurExtraite: string | null;
  statut: VerificationFieldStatus;
  score: number; // 0-100
  confiance: number; // 0-1
  explication: string;
  details?: Record<string, unknown>;
}

export interface VerificationDocumentInfo {
  fileId: number | null;
  type: string;
  originalName: string | null;
  mimetype: string | null;
  methode: 'native' | 'ocr' | 'none';
  taille: number | null;
  texteExtraitLongueur: number;
  confianceExtraction?: number;
  erreur?: string | null;
}

@Entity('admission_verifications')
export class AdmissionVerification {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: 'int' })
  admissionId!: number;

  @ManyToOne(() => Admission, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'admissionId' })
  admission!: Admission;

  @Column({ type: 'int', nullable: true })
  adminId!: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  adminEmail!: string | null;

  @Column({ type: 'varchar', length: 30 })
  statut!: VerificationGlobalStatus;

  @Column({ type: 'int' })
  score!: number;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  resultats!: VerificationFieldResult[];

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  documentsAnalyses!: VerificationDocumentInfo[];

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  textesExtraits!: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  erreurs!: string[] | null;

  @Column({ type: 'int', nullable: true })
  dureeMs!: number | null;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  creeLe!: Date;
}
