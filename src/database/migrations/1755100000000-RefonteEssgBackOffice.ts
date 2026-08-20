import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Refonte back-office ESSG :
 *  - formations.mention        : niveau 1 de la hiérarchie pédagogique ;
 *  - formations.responsableId  : lien vers la ressource humaine responsable ;
 *  - activity_logs.userName    : auteur dénormalisé pour un journal lisible.
 *
 * La migration est idempotente et rétro-compatible : aucune colonne existante
 * n'est supprimée (`conditionsAcces` et `modules` restent en base le temps que
 * les données historiques soient reprises).
 */
export class RefonteEssgBackOffice1755100000000 implements MigrationInterface {
  name = 'RefonteEssgBackOffice1755100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    /* ─── formations.mention ─── */
    if (!(await queryRunner.hasColumn('formations', 'mention'))) {
      await queryRunner.addColumn(
        'formations',
        new TableColumn({
          name: 'mention',
          type: 'varchar',
          length: '150',
          isNullable: true,
        }),
      );

      // Reprise des données : le premier élément de `domaine` devient la mention.
      await queryRunner.query(`
        UPDATE formations
        SET mention = COALESCE(NULLIF(domaine::jsonb ->> 0, ''), '')
        WHERE mention IS NULL
      `);
    }

    /* ─── formations.responsableId ─── */
    if (!(await queryRunner.hasColumn('formations', 'responsableId'))) {
      await queryRunner.addColumn(
        'formations',
        new TableColumn({
          name: 'responsableId',
          type: 'int',
          isNullable: true,
        }),
      );

      // Rattachement automatique quand le nom du responsable correspond
      // exactement à une ressource humaine existante.
      await queryRunner.query(`
        UPDATE formations f
        SET "responsableId" = rh.id
        FROM ressources_humaines rh
        WHERE f."responsableId" IS NULL
          AND f.responsable IS NOT NULL
          AND LOWER(TRIM(f.responsable)) IN (
            LOWER(TRIM(rh.prenom || ' ' || rh.nom)),
            LOWER(TRIM(rh.nom || ' ' || rh.prenom))
          )
      `);
    }

    /* ─── activity_logs.userName ─── */
    if (!(await queryRunner.hasColumn('activity_logs', 'userName'))) {
      await queryRunner.addColumn(
        'activity_logs',
        new TableColumn({
          name: 'userName',
          type: 'varchar',
          length: '200',
          isNullable: true,
        }),
      );

      // Reprise de l'historique à partir de la table users.
      await queryRunner.query(`
        UPDATE activity_logs l
        SET "userName" = TRIM(u.prenom || ' ' || u.nom)
        FROM users u
        WHERE l."userName" IS NULL AND l."userId" = u.id
      `);
    }

    /* ─── Fusion conditionsAcces → conditions ─── */
    // `conditionsAcces` (texte libre) faisait doublon avec `conditions` (liste).
    // On verse la valeur dans la liste lorsqu'elle n'y figure pas déjà.
    await queryRunner.query(`
      UPDATE formations
      SET conditions = (
        COALESCE(NULLIF(conditions, '')::jsonb, '[]'::jsonb)
        || jsonb_build_array("conditionsAcces")
      )::text
      WHERE "conditionsAcces" IS NOT NULL
        AND TRIM("conditionsAcces") <> ''
        AND NOT (
          COALESCE(NULLIF(conditions, '')::jsonb, '[]'::jsonb)
          @> jsonb_build_array("conditionsAcces")
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('activity_logs', 'userName')) {
      await queryRunner.dropColumn('activity_logs', 'userName');
    }
    if (await queryRunner.hasColumn('formations', 'responsableId')) {
      await queryRunner.dropColumn('formations', 'responsableId');
    }
    if (await queryRunner.hasColumn('formations', 'mention')) {
      await queryRunner.dropColumn('formations', 'mention');
    }
  }
}
