import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { UserRole } from '../users.constants';

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

  // Type explicite : l'alias UserRole n'est pas réfléchi par TypeORM. varchar(20) correspond au schéma existant.
  @Column({ type: 'varchar', length: 20, default: 'admin' })
  role: UserRole;

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
