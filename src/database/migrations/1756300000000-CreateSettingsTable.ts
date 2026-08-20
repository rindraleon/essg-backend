import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateSettingsTable1756300000000 implements MigrationInterface {
  name = 'CreateSettingsTable1756300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'app_settings',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
          },
          {
            name: 'admissionsOuvertes',
            type: 'boolean',
            default: 'true',
          },
          {
            name: 'creeLe',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'misAJourLe',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.query(`
      INSERT INTO app_settings (id, "admissionsOuvertes")
      VALUES (1, true)
      ON CONFLICT (id) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('app_settings');
  }
}
