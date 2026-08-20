import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AdmissionsSourcesSettings1756000000000 implements MigrationInterface {
  name = 'AdmissionsSourcesSettings1756000000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    const add = async (table: string, name: string, type: string) => { if (!(await queryRunner.hasColumn(table, name))) await queryRunner.addColumn(table, new TableColumn({ name, type, isNullable: true })); };
    await add('admissions', 'numeroInscriptionBac', 'varchar');
    await add('admissions', 'mention', 'varchar');
    await add('admissions', 'adresse', 'text');
    await add('admissions', 'releveBacPath', 'varchar');
    await add('admissions', 'releveL3Path', 'varchar');
    await add('admissions', 'attestationBacPath', 'varchar');
    await add('admissions', 'numeroBordereau', 'varchar');
    await add('admissions', 'bordereauPath', 'varchar');
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_admissions_numero_bordereau" ON "admissions" ("numeroBordereau") WHERE "numeroBordereau" IS NOT NULL`);
    await add('formations', 'sources', 'text');
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "site_settings" ("key" varchar(100) PRIMARY KEY, "booleanValue" boolean NOT NULL DEFAULT true, "misAJourLe" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    await queryRunner.query(`INSERT INTO "site_settings" ("key", "booleanValue") VALUES ('admissionEnabled', true) ON CONFLICT ("key") DO NOTHING`);
  }
  async down(queryRunner: QueryRunner): Promise<void> { await queryRunner.query(`DROP TABLE IF EXISTS "site_settings"`); await queryRunner.query(`DROP INDEX IF EXISTS "IDX_admissions_numero_bordereau"`); }
}
