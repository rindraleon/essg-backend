import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddAdmissionResponseFields1757200000000 implements MigrationInterface {
  name = 'AddAdmissionResponseFields1757200000000';

  private readonly columns: { name: string; type: string; length?: string }[] = [
    { name: 'reponseDate', type: 'varchar', length: '20' },
    { name: 'reponseHeure', type: 'varchar', length: '10' },
    { name: 'reponseLieu', type: 'varchar', length: '255' },
    { name: 'reponseInstructions', type: 'text' },
    { name: 'reponseMessage', type: 'text' },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('admissions'))) return;

    for (const column of this.columns) {
      if (await queryRunner.hasColumn('admissions', column.name)) continue;
      await queryRunner.addColumn(
        'admissions',
        new TableColumn({
          name: column.name,
          type: column.type,
          length: column.length,
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('admissions'))) return;

    for (const column of [...this.columns].reverse()) {
      if (await queryRunner.hasColumn('admissions', column.name)) {
        await queryRunner.dropColumn('admissions', column.name);
      }
    }
  }
}
