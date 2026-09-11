import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateAdmissionVerificationsTable1757500000000 implements MigrationInterface {
  name = 'CreateAdmissionVerificationsTable1757500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const has = await queryRunner.hasTable('admission_verifications');
    if (!has) {
      await queryRunner.createTable(
        new Table({
          name: 'admission_verifications',
          columns: [
            {
              name: 'id',
              type: 'int',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            { name: 'admissionId', type: 'int', isNullable: false },
            { name: 'adminId', type: 'int', isNullable: true },
            { name: 'adminEmail', type: 'varchar', length: '255', isNullable: true },
            { name: 'statut', type: 'varchar', length: '30', isNullable: false },
            { name: 'score', type: 'int', isNullable: false, default: 0 },
            { name: 'resultats', type: 'jsonb', isNullable: false, default: "'[]'::jsonb" },
            { name: 'documentsAnalyses', type: 'jsonb', isNullable: false, default: "'[]'::jsonb" },
            { name: 'textesExtraits', type: 'jsonb', isNullable: false, default: "'{}'::jsonb" },
            { name: 'erreurs', type: 'jsonb', isNullable: true },
            { name: 'dureeMs', type: 'int', isNullable: true },
            { name: 'creeLe', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
          ],
        }),
        true,
      );

      await queryRunner.createIndex(
        'admission_verifications',
        new TableIndex({ name: 'IDX_VERIFICATION_ADMISSION', columnNames: ['admissionId'] }),
      );
      await queryRunner.createIndex(
        'admission_verifications',
        new TableIndex({ name: 'IDX_VERIFICATION_CREELE', columnNames: ['creeLe'] }),
      );

      await queryRunner.createForeignKey(
        'admission_verifications',
        new TableForeignKey({
          name: 'FK_VERIFICATION_ADMISSION',
          columnNames: ['admissionId'],
          referencedTableName: 'admissions',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('admission_verifications')) {
      await queryRunner.dropForeignKey('admission_verifications', 'FK_VERIFICATION_ADMISSION');
      await queryRunner.dropIndex('admission_verifications', 'IDX_VERIFICATION_CREELE');
      await queryRunner.dropIndex('admission_verifications', 'IDX_VERIFICATION_ADMISSION');
      await queryRunner.dropTable('admission_verifications');
    }
  }
}
