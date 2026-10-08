import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Crée la hiérarchie Mention → Parcours.
 *
 * - `mentions` : nom unique, slug unique (déduplication accents/casse),
 *   domaine de rattachement, activation.
 * - `parcours` : rattaché à une mention obligatoire (FK RESTRICT), nom
 *   unique dans le contexte de la mention (contrainte (mentionId, slug)).
 */
export class CreateMentionsParcours1757700000000 implements MigrationInterface {
  name = 'CreateMentionsParcours1757700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mentions" (
        "id" serial NOT NULL,
        "nom" character varying(150) NOT NULL,
        "slug" character varying(200) NOT NULL,
        "domaine" character varying(150),
        "description" text,
        "isActive" boolean NOT NULL DEFAULT true,
        "creeLe" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "misAJourLe" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_mentions_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_mentions_nom" UNIQUE ("nom"),
        CONSTRAINT "UQ_mentions_slug" UNIQUE ("slug")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_mentions_domaine" ON "mentions" ("domaine")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "parcours" (
        "id" serial NOT NULL,
        "mentionId" integer NOT NULL,
        "nom" character varying(150) NOT NULL,
        "slug" character varying(200) NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "creeLe" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "misAJourLe" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_parcours_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_parcours_mention_slug" UNIQUE ("mentionId", "slug"),
        CONSTRAINT "FK_parcours_mention" FOREIGN KEY ("mentionId")
          REFERENCES "mentions"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_parcours_mention" ON "parcours" ("mentionId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "parcours"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "mentions"`);
  }
}
