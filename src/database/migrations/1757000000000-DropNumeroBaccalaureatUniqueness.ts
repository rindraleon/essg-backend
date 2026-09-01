import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropNumeroBaccalaureatUniqueness1757000000000 implements MigrationInterface {
  name = 'DropNumeroBaccalaureatUniqueness1757000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('admissions'))) {
      return;
    }

    // Le numéro d'inscription au baccalauréat n'est plus un critère de
    // détection des doublons : suppression de toute contrainte/index unique
    // portant sur cette colonne (nom généré par synchronize ou migration).
    await queryRunner.query(`
      DO $$
      DECLARE r record;
      BEGIN
        FOR r IN
          SELECT indexname FROM pg_indexes
          WHERE tablename = 'admissions'
            AND indexdef LIKE 'CREATE UNIQUE%'
            AND indexdef LIKE '%"numeroBaccalaureat"%'
        LOOP
          EXECUTE 'DROP INDEX ' || quote_ident(r.indexname);
        END LOOP;
      END $$;
    `);

    // Simple index de consultation (recherche dans le back-office).
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_admissions_numeroBaccalaureat" ON "admissions" ("numeroBaccalaureat")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('admissions'))) {
      return;
    }
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_admissions_numeroBaccalaureat"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_admissions_numeroBaccalaureat" ON "admissions" ("numeroBaccalaureat")`,
    );
  }
}
