import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Utilisateur } from '../../users/entities/user.entity';

@Entity('sessions')
@Index('IDX_sessions_user_revoked_expires', ['userId', 'revokedAt', 'expiresAt'])
@Index('IDX_sessions_expires_at', ['expiresAt'])
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_sessions_user_id')
  @Column({ type: 'int' })
  userId: number;

  @ManyToOne(() => Utilisateur, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  utilisateur?: Utilisateur;

  @Index('IDX_sessions_refresh_token_hash')
  @Column({ type: 'varchar', length: 64, unique: true })
  refreshTokenHash: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz' })
  lastActivityAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({ type: 'int', nullable: true })
  revokedBy: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  revokedReason: string | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  deviceName: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  browserName: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  osName: string | null;
}
