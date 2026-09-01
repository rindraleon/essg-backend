import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('partners')
export class Partenaire {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  nom!: string;

  @Column({ unique: true })
  slug!: string;

  @Column({ type: 'text', default: 'Entreprise' })
  type!: 'Entreprise' | 'Institution' | 'Organisation' | 'Autre';

  @Column({ type: 'text', nullable: true })
  secteur?: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ nullable: true })
  siteWeb?: string;

  @Column({ nullable: true })
  logo?: string;

  @Column({ nullable: true })
  contact?: string;

  @Column({ type: 'date', nullable: true })
  dateDebut?: Date;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  creeLe!: Date;

  @Column({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  misAJourLe!: Date;
}
