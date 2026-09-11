import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveAnnualUniquenessFromAdmissions1757400000000 implements MigrationInterface {
  name = 'RemoveAnnualUniquenessFromAdmissions1757400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('admissions'))) {
      return;
    }
    // Drop annual uniqueness constraints on email + telephone
    await queryRunner.query(
      `ALTER TABLE "admissions" DROP CONSTRAINT IF EXISTS "UQ_admissions_annee_email"`,
    );
    await queryRunner.query(
      `ALTER TABLE "admissions" DROP CONSTRAINT IF EXISTS "UQ_admissions_annee_telephone"`,
    );
    // Ensure unique index on numeroBordereau exists (unique for non-null values)
    // The entity defines @Index({ unique: true }) on numeroBordereau, ensure it exists.
    const hasBordereauIndex = (await queryRunner.query(
      `SELECT 1 FROM pg_indexes WHERE tablename = 'admissions' AND indexname = 'IDX_admissions_numeroBordereau'`,
    )) as unknown[];
    if (!hasBordereauIndex || hasBordereauIndex.length === 0) {
      // Check any unique index on numeroBordereau
      const duplicates = (await queryRunner.query(
        `SELECT indexname FROM pg_indexes WHERE tablename = 'admissions' AND indexdef LIKE '%"numeroBordereau"%' AND indexdef LIKE '%UNIQUE%'`,
      )) as unknown[];
      if (!duplicates || duplicates.length === 0) {
        await queryRunner.query(
          `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_admissions_numeroBordereau" ON "admissions" ("numeroBordereau") WHERE "numeroBordereau" IS NOT NULL`,
        );
      }
    }
    await queryRunner.query(`
      WITH ranked AS (
        SELECT id, "numeroBordereau",
               ROW_NUMBER() OVER (PARTITION BY "numeroBordereau" ORDER BY id) as rn
        FROM "admissions"
        WHERE "numeroBordereau" IS NOT NULL
      )
      UPDATE "admissions" SET "numeroBordereau" = NULL
      WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
    `);
    // Recreate unique index if dropped
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_admissions_numeroBordereau" ON "admissions" ("numeroBordereau") WHERE "numeroBordereau" IS NOT NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('admissions'))) {
      return;
    }
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_admissions_numeroBordereau"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_admissions_numeroBordereau" ON "admissions" ("numeroBordereau")`,
    );
    await queryRunner.query(
      `ALTER TABLE "admissions" ADD CONSTRAINT "UQ_admissions_annee_email" UNIQUE ("annee", "email")`,
    );
    await queryRunner.query(
      `ALTER TABLE "admissions" ADD CONSTRAINT "UQ_admissions_annee_telephone" UNIQUE ("annee", "telephone")`,
    );
  }
}
