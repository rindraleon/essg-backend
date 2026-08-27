import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUniqueEmailToRessourcesHumaines1755300000000 implements MigrationInterface {
  name = 'AddUniqueEmailToRessourcesHumaines1755300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE ressources_humaines
      SET email = LOWER(TRIM(email))
      WHERE email IS NOT NULL AND email <> LOWER(TRIM(email))
    `);

    const doublons = (await queryRunner.query(`
      SELECT id, email FROM (
        SELECT id, email,
               ROW_NUMBER() OVER (PARTITION BY LOWER(TRIM(email)) ORDER BY id) AS rang
        FROM ressources_humaines
        WHERE email IS NOT NULL AND TRIM(email) <> ''
      ) t WHERE rang > 1
    `)) as Array<{ id: number; email: string }>;

    for (const doublon of doublons) {
      await queryRunner.query(`UPDATE ressources_humaines SET email = $1 WHERE id = $2`, [
        `${doublon.email}.doublon-${doublon.id}`,
        doublon.id,
      ]);
    }

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_RH_EMAIL"
      ON "ressources_humaines" (email)
      WHERE email IS NOT NULL AND email <> ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "UQ_RH_EMAIL"');
  }
}
