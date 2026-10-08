import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rattache les formations aux parcours (hiérarchie Domaine → Mention →
 * Parcours → Formation) et migre les anciennes données.
 *
 * Stratégie de migration des données existantes — aucune formation perdue :
 *  1. chaque valeur distincte de `formations.mention` (après normalisation
 *     accents/casse) devient une mention ;
 *  2. chaque couple (mention, titre de formation) distinct devient un parcours
 *     de cette mention (les « titres » de l'ancien référentiel étaient en
 *     réalité les parcours) ;
 *  3. `formations.parcoursId` est pointé vers le parcours retrouvé.
 *
 * Les formations sans mention restent avec `parcoursId` NULL (aucune donnée
 * inventée) et seront rattachées depuis le back-office. Les colonnes
 * `mention`/`domaine` de `formations` sont conservées comme miroirs calculés.
 */
export class LinkFormationsToParcours1757800000000 implements MigrationInterface {
  name = 'LinkFormationsToParcours1757800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "formations"
        ADD COLUMN IF NOT EXISTS "parcoursId" integer
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_formations_parcoursId" ON "formations" ("parcoursId")
    `);
    await queryRunner.query(`
      ALTER TABLE "formations" DROP CONSTRAINT IF EXISTS "FK_formations_parcours"
    `);
    await queryRunner.query(`
      ALTER TABLE "formations"
        ADD CONSTRAINT "FK_formations_parcours" FOREIGN KEY ("parcoursId")
        REFERENCES "parcours"("id") ON DELETE RESTRICT
    `);

    // Fonction de normalisation locale à la migration (sans dépendance
    // d'extension type « unaccent », indisponible sur certaines instances).
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION pg_temp.essg_norm_slug(t text) RETURNS text AS $$
        SELECT trim(BOTH '-' FROM regexp_replace(
          translate(
            replace(replace(lower(t), 'œ', 'oe'), 'ç', 'c'),
            'àâáãäèéêëìíîïòôõöùúûü',
            'aaaaaeeeeiiiiooooouuuu'),
          '[^a-z0-9]+', '-', 'g'))
      $$ LANGUAGE sql IMMUTABLE
    `);

    const rows: unknown = await queryRunner.query(
      `SELECT COUNT(*)::int AS count FROM formations WHERE mention IS NOT NULL AND TRIM(mention) <> ''`,
    );
    const first = Array.isArray(rows) ? (rows[0] as { count?: number } | undefined) : undefined;
    const legacyCount = Number(first?.count ?? 0);
    if (legacyCount > 0) {
      await queryRunner.query(`
        INSERT INTO mentions (nom, slug, "isActive")
        SELECT upper(left(s.nom, 1)) || lower(substr(s.nom, 2)), s.slug, true
        FROM (
          SELECT MIN(TRIM(f.mention)) AS nom, pg_temp.essg_norm_slug(TRIM(f.mention)) AS slug
          FROM formations f
          WHERE f.mention IS NOT NULL AND TRIM(f.mention) <> ''
          GROUP BY pg_temp.essg_norm_slug(TRIM(f.mention))
        ) s
        WHERE s.slug <> ''
        ON CONFLICT DO NOTHING
      `);

      await queryRunner.query(`
        INSERT INTO parcours ("mentionId", nom, slug, "isActive")
        SELECT m.id, upper(left(t.nom, 1)) || lower(substr(t.nom, 2)), t.slug, true
        FROM (
          SELECT
            pg_temp.essg_norm_slug(TRIM(f.mention)) AS mslug,
            MIN(TRIM(f.titre)) AS nom,
            pg_temp.essg_norm_slug(TRIM(f.titre)) AS slug
          FROM formations f
          WHERE f.mention IS NOT NULL AND TRIM(f.mention) <> ''
          GROUP BY 1, 3
        ) t
        JOIN mentions m ON m.slug = t.mslug
        WHERE t.slug <> ''
        ON CONFLICT DO NOTHING
      `);

      await queryRunner.query(`
        UPDATE formations f
        SET "parcoursId" = p.id
        FROM mentions m
        JOIN parcours p ON p."mentionId" = m.id
        WHERE f."parcoursId" IS NULL
          AND f.mention IS NOT NULL AND TRIM(f.mention) <> ''
          AND m.slug = pg_temp.essg_norm_slug(TRIM(f.mention))
          AND p.slug = pg_temp.essg_norm_slug(TRIM(f.titre))
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "formations" DROP CONSTRAINT IF EXISTS "FK_formations_parcours"
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_formations_parcoursId"`);
    await queryRunner.query(`ALTER TABLE "formations" DROP COLUMN IF EXISTS "parcoursId"`);
  }
}
