import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Parcours structuré des ressources humaines (import de CV par OCR).
 *
 * L'OCR extrayait déjà expériences, formations, diplômes, compétences et
 * langues, mais ces données étaient aplaties dans le champ texte
 * `description` — donc inexploitables pour l'affichage public, la recherche
 * ou le filtrage. Elles disposent désormais de colonnes dédiées.
 *
 * Migration idempotente et non destructive : `description` est conservée
 * telle quelle (elle reste le résumé libre de la fiche).
 */
export class AddParcoursToRessourcesHumaines1755200000000 implements MigrationInterface {
  name = 'AddParcoursToRessourcesHumaines1755200000000';

  /** Colonnes JSON du parcours, toutes initialisées à un tableau vide. */
  private readonly jsonColumns = [
    'experiences',
    'formations',
    'diplomes',
    'competences',
    'langues',
  ] as const;

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('ressources_humaines', 'adresse'))) {
      await queryRunner.addColumn(
        'ressources_humaines',
        new TableColumn({ name: 'adresse', type: 'text', isNullable: true }),
      );
    }

    for (const column of this.jsonColumns) {
      if (await queryRunner.hasColumn('ressources_humaines', column)) continue;

      await queryRunner.addColumn(
        'ressources_humaines',
        new TableColumn({
          name: column,
          type: 'jsonb',
          isNullable: false,
          default: "'[]'::jsonb",
        }),
      );
    }

    // Index GIN sur les compétences : permet de rechercher efficacement
    // « qui maîtrise QGIS ? » sans parcourir toute la table.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_RH_COMPETENCES"
       ON "ressources_humaines" USING GIN ("competences")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_RH_COMPETENCES"');

    for (const column of [...this.jsonColumns].reverse()) {
      if (await queryRunner.hasColumn('ressources_humaines', column)) {
        await queryRunner.dropColumn('ressources_humaines', column);
      }
    }

    if (await queryRunner.hasColumn('ressources_humaines', 'adresse')) {
      await queryRunner.dropColumn('ressources_humaines', 'adresse');
    }
  }
}
