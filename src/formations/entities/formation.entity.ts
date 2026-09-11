import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Valeur par défaut des colonnes simple-json en liste vide. */
const EMPTY_ARRAY_DEFAULT = '[]';

/** Type des colonnes JSON simples stockées en texte. */
const SIMPLE_JSON = 'simple-json';

@Entity('formations')
export class Formation {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  slug!: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  mention!: string;

  @Column({ type: SIMPLE_JSON, default: EMPTY_ARRAY_DEFAULT })
  domaine!: string[];

  @Column()
  titre!: string;

  @Column({ type: 'text', default: 'Licence' })
  niveau!: 'Licence' | 'Master' | 'Doctorat';

  @Column()
  duree!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: SIMPLE_JSON, default: EMPTY_ARRAY_DEFAULT })
  objectifs!: string[];

  @Column({ type: SIMPLE_JSON, default: EMPTY_ARRAY_DEFAULT })
  debouches!: string[];

  @Column({ type: 'text', nullable: true })
  conditionsAcces!: string;

  @Column({ type: SIMPLE_JSON, default: EMPTY_ARRAY_DEFAULT })
  conditions!: string[];

  @Column({ type: SIMPLE_JSON, default: EMPTY_ARRAY_DEFAULT })
  competences!: string[];

  @Column({ type: SIMPLE_JSON, default: EMPTY_ARRAY_DEFAULT })
  modules!: any[];

  @Column({ type: 'int', default: 180 })
  credits!: number;

  @Column({ nullable: true })
  responsable!: string;

  @Column({ type: 'int', nullable: true })
  responsableId!: number | null;

  @Column({ nullable: true })
  email!: string;

  @Column({ type: SIMPLE_JSON, default: EMPTY_ARRAY_DEFAULT })
  programme!: string[];

  @Column({ default: '/images/hero-campus.jpg' })
  image!: string;

  @Column({ type: 'boolean', default: false })
  enVedette!: boolean;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  creeLe!: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  misAJourLe!: Date;
}
