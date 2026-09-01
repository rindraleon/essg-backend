import { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizePersonDisplayName1756500000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('activity_logs')) || !(await queryRunner.hasTable('users'))) {
      return;
    }
    await queryRunner.query(`
      UPDATE "activity_logs" AS log
      SET "userName" = TRIM(u."nom" || ' ' || u."prenom")
      FROM "users" AS u
      WHERE log."userId" = u."id"
    `);
  }

  down(): Promise<void> {
    return Promise.resolve();
  }
}
