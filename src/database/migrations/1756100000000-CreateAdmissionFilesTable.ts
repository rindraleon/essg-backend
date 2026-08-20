import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateAdmissionFilesTable1756100000000 implements MigrationInterface {
  name = 'CreateAdmissionFilesTable1756100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'admission_files',
        columns: [
          {
            name: 'id',
            type: 'serial',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'admissionId',
            type: 'int',
          },
          {
            name: 'type',
            type: 'enum',
            enum: ['cv', 'lettre', 'releve_bac', 'attestation_bac', 'releve_l3', 'bordereau'],
          },
          {
            name: 'originalName',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'objectPath',
            type: 'varchar',
            length: '500',
          },
          {
            name: 'mimetype',
            type: 'varchar',
            length: '120',
          },
          {
            name: 'size',
            type: 'int',
          },
          {
            name: 'creeLe',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'admission_files',
      new TableIndex({
        name: 'IDX_ADMISSION_FILES_ADMISSION_ID',
        columnNames: ['admissionId'],
      }),
    );

    await queryRunner.createForeignKey(
      'admission_files',
      new TableForeignKey({
        name: 'FK_ADMISSION_FILES_ADMISSION',
        columnNames: ['admissionId'],
        referencedTableName: 'admissions',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Reprise des pièces déjà stockées dans les colonnes historiques.
    await queryRunner.query(`
      INSERT INTO admission_files ("admissionId", type, "originalName", "objectPath", mimetype, size, "creeLe")
      SELECT id, 'cv', 'CV', "cvPath", 'application/octet-stream', 0, "creeLe"
      FROM admissions WHERE "cvPath" IS NOT NULL AND "cvPath" <> ''
    `);
    await queryRunner.query(`
      INSERT INTO admission_files ("admissionId", type, "originalName", "objectPath", mimetype, size, "creeLe")
      SELECT id, 'lettre', 'Lettre de motivation', "lettreMotivationPath", 'application/octet-stream', 0, "creeLe"
      FROM admissions WHERE "lettreMotivationPath" IS NOT NULL AND "lettreMotivationPath" <> ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('admission_files', 'FK_ADMISSION_FILES_ADMISSION');
    await queryRunner.dropIndex('admission_files', 'IDX_ADMISSION_FILES_ADMISSION_ID');
    await queryRunner.dropTable('admission_files');
  }
}
