import { Column, Entity, Index, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { AdmissionFile } from './admission-file.entity';

export enum AdmissionStatus {
  EN_ATTENTE = 'en_attente',
  EN_COURS_ETUDE = 'en_cours_etude',
  ACCEPTE = 'accepte',
  REFUSE = 'refuse',
}

@Entity('admissions')
export class Admission {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  nom!: string;

  @Column()
  prenom!: string;

  @Index()
  @Column()
  email!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  telephone!: string | null;

  @Index('IDX_admissions_annee')
  @Column({ type: 'int', default: () => "date_part('year', CURRENT_DATE)::int" })
  annee!: number;

  @Column()
  dateNaissance!: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  lieuNaissance!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  nationalite!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  genre!: string | null;

  @Column()
  niveau!: string;

  @Column()
  formation!: string;

  @Column()
  diplomePrecedent!: string;

  @Column({ type: 'text', nullable: true })
  adresse!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  bacType!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  bacSerie!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  bacCategorie!: string | null;

  @Index()
  @Column({ type: 'varchar', length: 100, nullable: true })
  numeroBaccalaureat!: string | null;

  @Column({ type: 'varchar', length: 4, nullable: true })
  bacAnneeObtention!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  bacCentreExamen!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  mention!: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  parcours!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  ancienEtablissement!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  numeroMatricule!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  licenceEtablissement!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  licenceMention!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  licenceAnneeObtention!: string | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100, nullable: true })
  numeroBordereau!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  sourceReconnaissance!: string | null;

  @Column({ nullable: true })
  cvPath!: string;

  @Column({ nullable: true })
  lettreMotivationPath!: string;

  @OneToMany(() => AdmissionFile, (file) => file.admission)
  files!: AdmissionFile[];

  @Index()
  @Column({
    type: 'enum',
    enum: AdmissionStatus,
    default: AdmissionStatus.EN_ATTENTE,
  })
  statut!: AdmissionStatus;

  @Column({ type: 'text', nullable: true })
  commentaire!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  reponseDate!: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  reponseHeure!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reponseLieu!: string | null;

  @Column({ type: 'text', nullable: true })
  reponseInstructions!: string | null;

  @Column({ type: 'text', nullable: true })
  reponseMessage!: string | null;

  @Index()
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  creeLe!: Date;

  @Column({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  misAJourLe!: Date;
}
