import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddAvatarToUsers1731598320000 implements MigrationInterface {
  name = 'AddAvatarToUsers1731598320000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('users', 'avatar')) return;
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'avatar',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('users', 'avatar'))) return;
    await queryRunner.dropColumn('users', 'avatar');
  }
}
