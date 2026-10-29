import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export type NavigationPrincipale = 'admission' | 'resultats' | 'aucun';

@Entity('app_settings')
export class AppSetting {
  @PrimaryColumn({ type: 'int', default: 1 })
  id!: number;

  @Column({ type: 'boolean', default: true })
  admissionsOuvertes!: boolean;

  @Column({
    type: 'varchar',
    length: 20,
    default: "'admission'",
  })
  navigationPrincipale!: NavigationPrincipale;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  creeLe!: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  misAJourLe!: Date;
}
