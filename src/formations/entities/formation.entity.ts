import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('formations')
export class Formation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  slug: string;

  // NOTE: le hook @BeforeInsert/@BeforeUpdate a été retiré : il faisait
  // doublon avec FormationsService et ne garantissait pas l'unicité du slug.
  // La génération est centralisée dans common/utils/slug.util.ts.

  /**
   * Mention / domaine pédagogique (niveau 1 de la hiérarchie ESSG).
   * Référentiel : formations/formation-mentions.constant.ts
   */
  @Column({ type: 'varchar', length: 150, nullable: true })
  mention: string;

  /**
   * @deprecated Conservé pour compatibilité ascendante ; la source de vérité
   * est désormais `mention`. Alimenté automatiquement avec [mention].
   */
  @Column({ type: 'simple-json', default: '[]' })
  domaine: string[];

  /** Titre de formation (niveau 2), rattaché à `mention`. */
  @Column()
  titre: string;

  @Column({ type: 'text', default: 'Licence' })
  niveau: 'Licence' | 'Master' | 'Doctorat';

  @Column()
  duree: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'simple-json', default: '[]' })
  objectifs: string[];

  @Column({ type: 'simple-json', default: '[]' })
  debouches: string[];

  /**
   * @deprecated Fusionné dans `conditions`. La colonne est conservée pour ne
   * pas perdre l'historique, mais n'est plus alimentée par le back-office.
   */
  @Column({ type: 'text', nullable: true })
  conditionsAcces: string;

  /** Conditions et prérequis d'accès — source de vérité unique. */
  @Column({ type: 'simple-json', default: '[]' })
  conditions: string[];

  @Column({ type: 'simple-json', default: '[]' })
  competences: string[];

  /**
   * @deprecated Redondant avec `programme`. Conservé en lecture seule pour
   * les données historiques structurées ({ semestre, cours }).
   */
  @Column({ type: 'simple-json', default: '[]' })
  modules: any[];

  @Column({ type: 'int', default: 180 })
  credits: number;

  /** Nom affiché du responsable (dénormalisé pour l'affichage public). */
  @Column({ nullable: true })
  responsable: string;

  /** Lien vers la ressource humaine responsable de la formation. */
  @Column({ type: 'int', nullable: true })
  responsableId: number | null;

  @Column({ nullable: true })
  email: string;

  @Column({ type: 'simple-json', default: '[]' })
  programme: string[];

  @Column({ default: '/images/hero-campus.jpg' })
  image: string;

  @Column({ type: 'boolean', default: false })
  enVedette: boolean;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  creeLe: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  misAJourLe: Date;
}
