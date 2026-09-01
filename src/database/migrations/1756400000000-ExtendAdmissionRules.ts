import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class ExtendAdmissionRules1756400000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const columns = [
      new TableColumn({ name: 'lieuNaissance', type: 'varchar', length: '150', isNullable: true }),
      new TableColumn({ name: 'nationalite', type: 'varchar', length: '100', isNullable: true }),
      new TableColumn({ name: 'sexe', type: 'varchar', length: '20', isNullable: true }),
      new TableColumn({ name: 'bacType', type: 'varchar', length: '20', isNullable: true }),
      new TableColumn({ name: 'bacSerie', type: 'varchar', length: '50', isNullable: true }),
      new TableColumn({ name: 'bacCategorie', type: 'varchar', length: '30', isNullable: true }),
      new TableColumn({
        name: 'bacAnneeObtention',
        type: 'varchar',
        length: '4',
        isNullable: true,
      }),
      new TableColumn({
        name: 'bacCentreExamen',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
      new TableColumn({ name: 'mention', type: 'varchar', length: '100', isNullable: true }),
      new TableColumn({ name: 'parcours', type: 'varchar', length: '150', isNullable: true }),
      new TableColumn({
        name: 'ancienEtablissement',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
      new TableColumn({
        name: 'numeroMatricule',
        type: 'varchar',
        length: '100',
        isNullable: true,
      }),
    ];
    for (const column of columns) {
      if (!(await queryRunner.hasColumn('admissions', column.name))) {
        await queryRunner.addColumn('admissions', column);
      }
    }
    await queryRunner.query(
      `ALTER TYPE "admission_files_type_enum" ADD VALUE IF NOT EXISTS 'demande_inscription'`,
    );
    await queryRunner.query(
      `ALTER TYPE "admission_files_type_enum" ADD VALUE IF NOT EXISTS 'photo_identite'`,
    );
    await queryRunner.query(
      `ALTER TYPE "admission_files_type_enum" ADD VALUE IF NOT EXISTS 'acte_etat_civil'`,
    );
    await queryRunner.query(
      `ALTER TYPE "admission_files_type_enum" ADD VALUE IF NOT EXISTS 'diplome_bac'`,
    );
    await queryRunner.query(
      `ALTER TYPE "admission_files_type_enum" ADD VALUE IF NOT EXISTS 'attestation_etablissement'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const columns = [
      'numeroMatricule',
      'ancienEtablissement',
      'parcours',
      'mention',
      'bacCentreExamen',
      'bacAnneeObtention',
      'bacCategorie',
      'bacSerie',
      'bacType',
      'sexe',
      'nationalite',
      'lieuNaissance',
    ];
    for (const column of columns) {
      if (await queryRunner.hasColumn('admissions', column))
        await queryRunner.dropColumn('admissions', column);
    }
  }
}
