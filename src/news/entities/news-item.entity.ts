import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('news')
export class Actualite {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  slug!: string;

  @Column()
  titre!: string;

  @Column()
  categorie!: string;

  @Column()
  date!: string;

  @Column({ type: 'text' })
  resume!: string;

  @Column({ type: 'text' })
  contenu!: string;

  @Column({ nullable: true })
  auteur?: string;

  @Column({ type: 'boolean', default: false })
  statut!: boolean;

  @Column({ nullable: true })
  image?: string;

  @Column({ type: 'simple-json', default: '[]' })
  galerie!: string[];

  @Column({ type: 'boolean', default: false })
  enVedette!: boolean;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  creeLe!: Date;

  @Column({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  misAJourLe!: Date;
}
