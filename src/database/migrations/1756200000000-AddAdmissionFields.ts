import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddAdmissionFields1756200000000 implements MigrationInterface {
  name = 'AddAdmissionFields1756200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('admissions', 'adresse'))) {
      await queryRunner.addColumn(
        'admissions',
        new TableColumn({
          name: 'adresse',
          type: 'text',
          isNullable: true,
        }),
      );
    }
    if (!(await queryRunner.hasColumn('admissions', 'numeroBaccalaureat'))) {
      await queryRunner.addColumn(
        'admissions',
        new TableColumn({
          name: 'numeroBaccalaureat',
          type: 'varchar',
          length: '100',
          isNullable: true,
        }),
      );
    }
    if (!(await queryRunner.hasColumn('admissions', 'licenceEtablissement'))) {
      await queryRunner.addColumn(
        'admissions',
        new TableColumn({
          name: 'licenceEtablissement',
          type: 'varchar',
          length: '255',
          isNullable: true,
        }),
      );
    }
    if (!(await queryRunner.hasColumn('admissions', 'licenceMention'))) {
      await queryRunner.addColumn(
        'admissions',
        new TableColumn({
          name: 'licenceMention',
          type: 'varchar',
          length: '255',
          isNullable: true,
        }),
      );
    }
    if (!(await queryRunner.hasColumn('admissions', 'licenceAnneeObtention'))) {
      await queryRunner.addColumn(
        'admissions',
        new TableColumn({
          name: 'licenceAnneeObtention',
          type: 'varchar',
          length: '20',
          isNullable: true,
        }),
      );
    }
    if (!(await queryRunner.hasColumn('admissions', 'numeroBordereau'))) {
      await queryRunner.addColumn(
        'admissions',
        new TableColumn({
          name: 'numeroBordereau',
          type: 'varchar',
          length: '100',
          isNullable: true,
        }),
      );
    }

    await queryRunner.createIndex(
      'admissions',
      new TableIndex({
        name: 'IDX_ADMISSIONS_NUMERO_BACCALAUREAT',
        columnNames: ['numeroBaccalaureat'],
        isUnique: true,
      }),
    );
    await queryRunner.createIndex(
      'admissions',
      new TableIndex({
        name: 'IDX_ADMISSIONS_NUMERO_BORDEREAU',
        columnNames: ['numeroBordereau'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('admissions', 'IDX_ADMISSIONS_NUMERO_BORDEREAU');
    await queryRunner.dropIndex('admissions', 'IDX_ADMISSIONS_NUMERO_BACCALAUREAT');
    for (const column of [
      'numeroBordereau',
      'licenceAnneeObtention',
      'licenceMention',
      'licenceEtablissement',
      'numeroBaccalaureat',
      'adresse',
    ]) {
      if (await queryRunner.hasColumn('admissions', column)) {
        await queryRunner.dropColumn('admissions', column);
      }
    }
  }
}
