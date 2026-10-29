import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ResultatIndividuel } from './resultat-individuel.entity';

export enum ResultatPublicationType {
  EXCEL = 'excel',
  PDF = 'pdf',
}

export enum ResultatPublicationStatus {
  BROUILLON = 'brouillon',
  PUBLIE = 'publie',
  ARCHIVE = 'archive',
}

export enum ResultatConsultationMode {
  PUBLIC = 'public',
  PROTEGE = 'protege',
}

@Entity('resultat_publications')
export class ResultatPublication {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 200 })
  titre!: string;

  @Column({
    type: 'enum',
    enum: ResultatPublicationType,
  })
  type!: ResultatPublicationType;

  @Column({ type: 'varchar', length: 50 })
  anneeScolaire!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  periode!: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  classeFormation!: string | null;

  @Column({ type: 'varchar', length: 255 })
  fichierOriginal!: string;

  @Column({ type: 'varchar', length: 500 })
  objetChemin!: string;

  @Column({ type: 'varchar', length: 120 })
  mimeType!: string;

  @Column({ type: 'int' })
  taille!: number;

  @Column({
    type: 'enum',
    enum: ResultatPublicationStatus,
    default: ResultatPublicationStatus.BROUILLON,
  })
  statutPublication!: ResultatPublicationStatus;

  @Column({
    type: 'enum',
    enum: ResultatConsultationMode,
    default: ResultatConsultationMode.PROTEGE,
  })
  modeConsultation!: ResultatConsultationMode;

  @Column({ type: 'boolean', default: false })
  autorisePublicationPublique!: boolean;

  @Column({ type: 'int', default: 0 })
  totalIndividuels!: number;

  @Column({ type: 'int', default: 0 })
  totalAdmis!: number;

  @Column({ type: 'int', default: 0 })
  totalAjourne!: number;

  @Column({ type: 'int', nullable: true })
  creePar!: number | null;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  creeLe!: Date;

  @Column({ type: 'int', nullable: true })
  misAJourPar!: number | null;

  @Column({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  misAJourLe!: Date;

  @OneToMany(() => ResultatIndividuel, (resultat) => resultat.publication)
  resultatsIndividuels!: ResultatIndividuel[];
}
