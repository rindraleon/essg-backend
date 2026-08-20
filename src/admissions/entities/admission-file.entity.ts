import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Admission } from './admission.entity';

export enum AdmissionFileType {
  CV = 'cv',
  LETTRE = 'lettre',
  RELEVE_BAC = 'releve_bac',
  ATTESTATION_BAC = 'attestation_bac',
  RELEVE_L3 = 'releve_l3',
  BORDEREAU = 'bordereau',
}

export const ADMISSION_FILE_TYPES = Object.values(AdmissionFileType);

@Entity('admission_files')
export class AdmissionFile {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: 'int' })
  admissionId!: number;

  @ManyToOne(() => Admission, (admission) => admission.files, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'admissionId' })
  admission!: Admission;

  @Column({ type: 'enum', enum: AdmissionFileType })
  type!: AdmissionFileType;

  @Column({ type: 'varchar', length: 255 })
  originalName!: string;

  @Column({ type: 'varchar', length: 500 })
  objectPath!: string;

  @Column({ type: 'varchar', length: 120 })
  mimetype!: string;

  @Column({ type: 'int' })
  size!: number;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  creeLe!: Date;
}
