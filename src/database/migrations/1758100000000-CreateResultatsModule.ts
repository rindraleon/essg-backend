import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateResultatsModule1758100000000 implements MigrationInterface {
  name = 'CreateResultatsModule1758100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'resultat_publications',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'titre',
            type: 'varchar',
            length: '200',
          },
          {
            name: 'type',
            type: 'enum',
            enum: ['excel', 'pdf'],
          },
          {
            name: 'anneeScolaire',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'periode',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'classeFormation',
            type: 'varchar',
            length: '150',
            isNullable: true,
          },
          {
            name: 'fichierOriginal',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'objetChemin',
            type: 'varchar',
            length: '500',
          },
          {
            name: 'mimeType',
            type: 'varchar',
            length: '120',
          },
          {
            name: 'taille',
            type: 'int',
          },
          {
            name: 'statutPublication',
            type: 'enum',
            enum: ['brouillon', 'publie', 'archive'],
            default: "'brouillon'",
          },
          {
            name: 'modeConsultation',
            type: 'enum',
            enum: ['public', 'protege'],
            default: "'protege'",
          },
          {
            name: 'autorisePublicationPublique',
            type: 'boolean',
            default: 'false',
          },
          {
            name: 'creePar',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'creeLe',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'misAJourPar',
            type: 'int',
            isNullable: true,
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

    await queryRunner.createIndex(
      'resultat_publications',
      new TableIndex({
        name: 'IDX_RESULTAT_PUBLICATIONS_STATUT',
        columnNames: ['statutPublication'],
      }),
    );
    await queryRunner.createIndex(
      'resultat_publications',
      new TableIndex({
        name: 'IDX_RESULTAT_PUBLICATIONS_ANNEE',
        columnNames: ['anneeScolaire'],
      }),
    );
    await queryRunner.createIndex(
      'resultat_publications',
      new TableIndex({
        name: 'IDX_RESULTAT_PUBLICATIONS_CREE_LE',
        columnNames: ['creeLe'],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'resultats_individuels',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'publicationId',
            type: 'int',
          },
          {
            name: 'matricule',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'nom',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'prenom',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'classe',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'periode',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'notes',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'moyenne',
            type: 'numeric',
            precision: 4,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'statutAcademique',
            type: 'enum',
            enum: ['admis', 'ajourne'],
            isNullable: true,
          },
          {
            name: 'observation',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'codeConsultation',
            type: 'varchar',
            length: '20',
            isNullable: true,
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
      'resultats_individuels',
      new TableIndex({
        name: 'IDX_RESULTATS_INDIVIDUELS_PUBLICATION',
        columnNames: ['publicationId'],
      }),
    );
    await queryRunner.createIndex(
      'resultats_individuels',
      new TableIndex({
        name: 'IDX_RESULTATS_INDIVIDUELS_MATRICULE',
        columnNames: ['matricule'],
      }),
    );

    await queryRunner.createForeignKey(
      'resultats_individuels',
      new TableForeignKey({
        name: 'FK_RESULTATS_INDIVIDUELS_PUBLICATION',
        columnNames: ['publicationId'],
        referencedTableName: 'resultat_publications',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Un seul résultat individuel par matricule et par publication.
    await queryRunner.query(`
      ALTER TABLE resultats_individuels
      ADD CONSTRAINT UQ_resultats_individuels_publication_matricule
      UNIQUE ("publicationId", matricule)
    `);

    // Paramètre de navigation principale : Admission (par défaut) / Résultats / Aucun.
    await queryRunner.query(`
      ALTER TABLE app_settings
      ADD COLUMN IF NOT EXISTS "navigationPrincipale" varchar(20) NOT NULL DEFAULT 'admission'
    `);
    await queryRunner.query(`
      UPDATE app_settings
      SET "navigationPrincipale" = 'admission'
      WHERE "navigationPrincipale" IS NULL OR "navigationPrincipale" = ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE resultats_individuels
      DROP CONSTRAINT IF EXISTS UQ_resultats_individuels_publication_matricule
    `);
    await queryRunner.dropForeignKey(
      'resultats_individuels',
      'FK_RESULTATS_INDIVIDUELS_PUBLICATION',
    );
    await queryRunner.dropIndex('resultats_individuels', 'IDX_RESULTATS_INDIVIDUELS_MATRICULE');
    await queryRunner.dropIndex('resultats_individuels', 'IDX_RESULTATS_INDIVIDUELS_PUBLICATION');
    await queryRunner.dropTable('resultats_individuels');

    await queryRunner.dropIndex('resultat_publications', 'IDX_RESULTAT_PUBLICATIONS_CREE_LE');
    await queryRunner.dropIndex('resultat_publications', 'IDX_RESULTAT_PUBLICATIONS_ANNEE');
    await queryRunner.dropIndex('resultat_publications', 'IDX_RESULTAT_PUBLICATIONS_STATUT');
    await queryRunner.dropTable('resultat_publications');

    await queryRunner.query(`
      ALTER TABLE app_settings
      DROP COLUMN IF EXISTS "navigationPrincipale"
    `);
  }
}
