import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTotalsToResultatPublications1760000000000 implements MigrationInterface {
  name = 'AddTotalsToResultatPublications1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "resultat_publications" ADD COLUMN "totalIndividuels" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "resultat_publications" ADD COLUMN "totalAdmis" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "resultat_publications" ADD COLUMN "totalAjourne" integer NOT NULL DEFAULT 0`,
    );

    // Calculer les totaux pour les publications existantes
    await queryRunner.query(`
      UPDATE "resultat_publications" r SET
        "totalIndividuels" = COALESCE((
          SELECT COUNT(*) FROM "resultats_individuels" ri WHERE ri."publicationId" = r.id
        ), 0),
        "totalAdmis" = COALESCE((
          SELECT COUNT(*) FROM "resultats_individuels" ri 
          WHERE ri."publicationId" = r.id AND ri."statutAcademique" = 'admis'
        ), 0),
        "totalAjourne" = COALESCE((
          SELECT COUNT(*) FROM "resultats_individuels" ri 
          WHERE ri."publicationId" = r.id AND ri."statutAcademique" = 'ajourne'
        ), 0)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "resultat_publications" DROP COLUMN "totalAjourne"`,
    );
    await queryRunner.query(
      `ALTER TABLE "resultat_publications" DROP COLUMN "totalAdmis"`,
    );
    await queryRunner.query(
      `ALTER TABLE "resultat_publications" DROP COLUMN "totalIndividuels"`,
    );
  }
}
