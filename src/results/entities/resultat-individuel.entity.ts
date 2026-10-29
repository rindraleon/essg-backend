import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ResultatPublication } from './resultat-publication.entity';

export enum StatutAcademique {
  ADMIS = 'admis',
  AJOURNE = 'ajourne',
}

@Entity('resultats_individuels')
export class ResultatIndividuel {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  publicationId!: number;

  @Index()
  @Column({ type: 'varchar', length: 50 })
  matricule!: string;

  @Column({ type: 'varchar', length: 100 })
  nom!: string;

  @Column({ type: 'varchar', length: 100 })
  prenom!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  classe!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  periode!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  notes!: Record<string, unknown> | null;

  @Column({ type: 'numeric', precision: 4, scale: 2, nullable: true })
  moyenne!: number | null;

  @Column({
    type: 'enum',
    enum: StatutAcademique,
    nullable: true,
  })
  statutAcademique!: StatutAcademique | null;

  @Column({ type: 'text', nullable: true })
  observation!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  codeConsultation!: string | null;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  creeLe!: Date;

  @ManyToOne(() => ResultatPublication, (publication) => publication.resultatsIndividuels, {
    onDelete: 'CASCADE',
  })
  publication!: ResultatPublication;
}
