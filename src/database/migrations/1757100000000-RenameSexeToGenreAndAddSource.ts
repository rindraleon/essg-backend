import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameSexeToGenreAndAddSource1757100000000 implements MigrationInterface {
  name = 'RenameSexeToGenreAndAddSource1757100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('admissions'))) {
      return;
    }

    const hasSexe = await queryRunner.hasColumn('admissions', 'sexe');
    const hasGenre = await queryRunner.hasColumn('admissions', 'genre');

    if (hasSexe && !hasGenre) {
      await queryRunner.query(`ALTER TABLE "admissions" RENAME COLUMN "sexe" TO "genre"`);
    } else if (!hasGenre) {
      await queryRunner.query(`ALTER TABLE "admissions" ADD COLUMN "genre" character varying(20)`);
    } else if (hasSexe) {
      await queryRunner.query(
        `UPDATE "admissions" SET "genre" = "sexe" WHERE "genre" IS NULL AND "sexe" IS NOT NULL`,
      );
      await queryRunner.query(`ALTER TABLE "admissions" DROP COLUMN "sexe"`);
    }

    if (!(await queryRunner.hasColumn('admissions', 'sourceReconnaissance'))) {
      await queryRunner.query(
        `ALTER TABLE "admissions" ADD COLUMN "sourceReconnaissance" character varying(50)`,
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('admissions'))) {
      return;
    }

    if (await queryRunner.hasColumn('admissions', 'sourceReconnaissance')) {
      await queryRunner.query(`ALTER TABLE "admissions" DROP COLUMN "sourceReconnaissance"`);
    }

    const hasGenre = await queryRunner.hasColumn('admissions', 'genre');
    const hasSexe = await queryRunner.hasColumn('admissions', 'sexe');
    if (hasGenre && !hasSexe) {
      await queryRunner.query(`ALTER TABLE "admissions" RENAME COLUMN "genre" TO "sexe"`);
    }
  }
}
