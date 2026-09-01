import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateAdmissionsTable1753178400000 implements MigrationInterface {
  name = 'CreateAdmissionsTable1753178400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'admissions',
        columns: [
          {
            name: 'id',
            type: 'serial',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'nom',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'prenom',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'email',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'telephone',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'dateNaissance',
            type: 'date',
          },
          {
            name: 'niveau',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'formation',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'diplomePrecedent',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'cvPath',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'lettreMotivationPath',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'statut',
            type: 'enum',
            enum: ['en_attente', 'en_cours_etude', 'accepte', 'refuse'],
            default: "'en_attente'",
          },
          {
            name: 'commentaire',
            type: 'text',
            isNullable: true,
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
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'admissions',
      new TableIndex({
        name: 'IDX_ADMISSIONS_EMAIL',
        columnNames: ['email'],
      }),
    );

    await queryRunner.createIndex(
      'admissions',
      new TableIndex({
        name: 'IDX_ADMISSIONS_STATUT',
        columnNames: ['statut'],
      }),
    );

    await queryRunner.createIndex(
      'admissions',
      new TableIndex({
        name: 'IDX_ADMISSIONS_CREE_LE',
        columnNames: ['creeLe'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('admissions', 'IDX_ADMISSIONS_CREE_LE');
    await queryRunner.dropIndex('admissions', 'IDX_ADMISSIONS_STATUT');
    await queryRunner.dropIndex('admissions', 'IDX_ADMISSIONS_EMAIL');
    await queryRunner.dropTable('admissions');
  }
}
