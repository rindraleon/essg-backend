import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAnnualUniquenessToAdmissions1756600000000 implements MigrationInterface {
  name = 'AddAnnualUniquenessToAdmissions1756600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('admissions'))) {
      return;
    }

    // 1. Année de dépôt : colonne, remplissage depuis creeLe, NOT NULL,
    // puis DEFAULT (identique à celui de l'entité pour converge avec synchronize).
    if (!(await queryRunner.hasColumn('admissions', 'annee'))) {
      await queryRunner.query(`ALTER TABLE "admissions" ADD "annee" integer`);
      await queryRunner.query(`UPDATE "admissions" SET "annee" = EXTRACT(YEAR FROM "creeLe")::int`);
      await queryRunner.query(`ALTER TABLE "admissions" ALTER COLUMN "annee" SET NOT NULL`);
    }
    await queryRunner.query(
      `ALTER TABLE "admissions" ALTER COLUMN "annee" SET DEFAULT date_part('year', CURRENT_DATE)::int`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_admissions_annee" ON "admissions" ("annee")`,
    );

    // 2a. Normalisation des emails : trim + minuscules.
    await queryRunner.query(`UPDATE "admissions" SET "email" = LOWER(TRIM("email"))`);

    // 2b. Normalisation des téléphones : chiffres uniquement, préfixes
    // internationaux (+261 / 00261) ramenés au format local malgache (0…).
    await queryRunner.query(`
      UPDATE "admissions" AS a
      SET "telephone" = n.normalized
      FROM (
        SELECT id,
          CASE
            WHEN digits = '' THEN NULL
            WHEN digits LIKE '00261%' THEN '0' || SUBSTR(digits, 6)
            WHEN digits LIKE '261%' AND LENGTH(digits) = 12 THEN '0' || SUBSTR(digits, 4)
            ELSE digits
          END AS normalized
        FROM (
          SELECT id, regexp_replace(COALESCE("telephone", ''), '\\D', '', 'g') AS digits
          FROM "admissions"
        ) AS d
      ) AS n
      WHERE a.id = n.id
    `);

    // 3. Dédoublonnage : pour une même année, le dossier le plus ancien est
    // conservé ; les pièces jointes suivent via ON DELETE CASCADE.
    await queryRunner.query(`
      DELETE FROM "admissions" AS a
      USING "admissions" AS b
      WHERE a."annee" = b."annee"
        AND a."email" = b."email"
        AND a.id > b.id
    `);
    await queryRunner.query(`
      DELETE FROM "admissions" AS a
      USING "admissions" AS b
      WHERE a."annee" = b."annee"
        AND a."telephone" IS NOT NULL
        AND a."telephone" = b."telephone"
        AND a.id > b.id
    `);

    // 4. Contraintes d'unicité annuelles (créées uniquement si absentes :
    // synchronize peut déjà les avoir posées depuis les décorateurs @Unique).
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UQ_admissions_annee_email') THEN
          ALTER TABLE "admissions" ADD CONSTRAINT "UQ_admissions_annee_email" UNIQUE ("annee", "email");
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UQ_admissions_annee_telephone') THEN
          ALTER TABLE "admissions" ADD CONSTRAINT "UQ_admissions_annee_telephone" UNIQUE ("annee", "telephone");
        END IF;
      END $$;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('admissions'))) {
      return;
    }
    await queryRunner.query(
      `ALTER TABLE "admissions" DROP CONSTRAINT IF EXISTS "UQ_admissions_annee_telephone"`,
    );
    await queryRunner.query(
      `ALTER TABLE "admissions" DROP CONSTRAINT IF EXISTS "UQ_admissions_annee_email"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_admissions_annee"`);
    await queryRunner.query(`ALTER TABLE "admissions" DROP COLUMN IF EXISTS "annee"`);
  }
}
