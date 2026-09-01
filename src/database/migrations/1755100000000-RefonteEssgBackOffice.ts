import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class RefonteEssgBackOffice1755100000000 implements MigrationInterface {
  name = 'RefonteEssgBackOffice1755100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
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

      await queryRunner.query(`
        UPDATE formations
        SET mention = COALESCE(NULLIF(domaine::jsonb ->> 0, ''), '')
        WHERE mention IS NULL
      `);
    }

    if (!(await queryRunner.hasColumn('formations', 'responsableId'))) {
      await queryRunner.addColumn(
        'formations',
        new TableColumn({
          name: 'responsableId',
          type: 'int',
          isNullable: true,
        }),
      );

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

      await queryRunner.query(`
        UPDATE activity_logs l
        SET "userName" = TRIM(u.nom || ' ' || u.prenom)
        FROM users u
        WHERE l."userName" IS NULL AND l."userId" = u.id
      `);
    }

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
