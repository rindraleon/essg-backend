import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

export interface ExperienceProfessionnelle {
  poste: string;
  organisation?: string;
  periode?: string;
}

@Entity('ressources_humaines')
export class RessourceHumaine {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  slug!: string;

  @Column()
  nom!: string;

  @Column()
  prenom!: string;

  @Column()
  poste!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ nullable: true })
  telephone?: string;

  @Column({ type: 'text', nullable: true })
  adresse?: string;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  experiences!: ExperienceProfessionnelle[];

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  formations!: string[];

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  diplomes!: string[];

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  competences!: string[];

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  langues!: string[];

  @Column({ nullable: true })
  photo?: string;

  @Column({ type: 'boolean', default: true })
  actif!: boolean;

  @Column({ type: 'integer', default: 0 })
  ordre!: number;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  creeLe!: Date;

  @Column({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  misAJourLe!: Date;
}
