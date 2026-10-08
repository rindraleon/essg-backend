import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Mention } from './mention.entity';


@Entity('parcours')
@Index('UQ_parcours_mention_slug', ['mentionId', 'slug'], { unique: true })
export class Parcours {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  mentionId!: number;

  @ManyToOne(() => Mention, (mention) => mention.parcours, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'mentionId' })
  mention?: Mention;

  @Column({ type: 'varchar', length: 150 })
  nom!: string;

  @Column({ type: 'varchar', length: 200 })
  slug!: string;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  creeLe!: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  misAJourLe!: Date;
}
