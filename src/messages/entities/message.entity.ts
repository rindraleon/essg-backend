import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  prenom!: string;

  @Column()
  nom!: string;

  @Column()
  email!: string;

  @Column({ nullable: true })
  telephone!: string;

  @Index()
  @Column()
  sujet!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'boolean', default: false })
  lu!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  luLe!: Date | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  luPar!: string | null;

  @Column({ type: 'text', nullable: true })
  reponse!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  reponseSujet!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reponduLe!: Date | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  reponduPar!: string | null;

  @Index()
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  creeLe!: Date;

  @Column({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  misAJourLe!: Date;
}
