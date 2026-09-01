import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddSourcesToProjects1756000000000 implements MigrationInterface {
  name = 'AddSourcesToProjects1756000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('projects', 'sources'))) {
      await queryRunner.addColumn(
        'projects',
        new TableColumn({
          name: 'sources',
          type: 'text',
          default: "'[]'",
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('projects', 'sources')) {
      await queryRunner.dropColumn('projects', 'sources');
    }
  }
}
