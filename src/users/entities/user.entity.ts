import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class Utilisateur {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  motDePasse: string;

  @Column()
  prenom: string;

  @Column()
  nom: string;

  @Column({ default: 'admin' })
  role: 'admin' | 'editeur' | 'lecteur';

  @Column({ default: true })
  estActif: boolean;

  @Column({ nullable: true })
  avatar?: string;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  creeLe: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  misAJourLe: Date;
}
