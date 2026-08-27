import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

export interface ProjectSource {
  title: string;
  url: string;
}

@Entity('projects')
export class Projet {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  titre!: string;

  @Column({ nullable: true })
  slug!: string;

  @Column({ type: 'text', default: 'Recherche' })
  type!: 'International' | 'Service public' | 'Recherche' | 'Partenariat';

  @Column({ type: 'text', default: 'En cours' })
  statut!: 'En cours' | 'Terminé';

  @Column()
  date!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'simple-json', default: '[]' })
  partenaireIds!: number[];

  @Column({ type: 'simple-json', default: '[]' })
  partenaires!: string[];

  @Column({ default: '/images/hero-campus.jpg' })
  image!: string;

  @Column({ type: 'simple-json', default: '[]' })
  galerie!: string[];

  @Column({ type: 'simple-json', default: '[]' })
  sources!: ProjectSource[];

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude?: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude?: number;

  @Column({ nullable: true })
  ville?: string;

  @Column({ nullable: true })
  pays?: string;

  @Column({ type: 'text', nullable: true })
  adresse?: string;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  creeLe!: Date;

  @Column({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  misAJourLe!: Date;
}
