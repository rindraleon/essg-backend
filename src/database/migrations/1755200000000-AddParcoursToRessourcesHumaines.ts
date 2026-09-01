import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddParcoursToRessourcesHumaines1755200000000 implements MigrationInterface {
  name = 'AddParcoursToRessourcesHumaines1755200000000';

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
