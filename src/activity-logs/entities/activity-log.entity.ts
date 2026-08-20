import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('activity_logs')
export class ActivityLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'int', nullable: true })
  userId: number | null;

  /**
   * Nom complet de l'auteur, dénormalisé au moment de l'écriture.
   * Évite une jointure (et un N+1) à chaque lecture du journal, et conserve
   * la trace lisible même si le compte utilisateur est supprimé.
   */
  @Column({ type: 'varchar', length: 200, nullable: true })
  userName: string | null;

  @Column({ type: 'varchar', length: 100 })
  action: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 10 })
  method: string;

  @Index()
  @Column({ type: 'varchar', length: 255 })
  endpoint: string;

  @Index()
  @Column({ type: 'varchar', length: 100 })
  module: string;

  @Column({ type: 'int' })
  statusCode: number;

  @Index()
  @Column({ type: 'boolean' })
  success: boolean;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
