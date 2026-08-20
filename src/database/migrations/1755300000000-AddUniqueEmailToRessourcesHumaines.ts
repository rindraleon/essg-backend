import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Unicité de l'email des ressources humaines.
 *
 * Le contrôle applicatif (`assertEmailIsAvailable`) produit un message clair,
 * mais ne protège pas des écritures concurrentes : deux requêtes simultanées
 * peuvent passer le contrôle avant que l'une n'ait enregistré. Cet index
 * garantit l'intégrité au niveau de la base.
 *
 * Index PARTIEL (`WHERE email IS NOT NULL AND email <> ''`) : l'email est
 * facultatif pour une ressource humaine, et plusieurs fiches peuvent
 * légitimement ne pas en avoir. Un index unique classique traiterait les
 * valeurs vides comme des doublons.
 */
export class AddUniqueEmailToRessourcesHumaines1755300000000 implements MigrationInterface {
  name = 'AddUniqueEmailToRessourcesHumaines1755300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Normalisation préalable : sans elle, « Jean@Essg.mg » et « jean@essg.mg »
    // coexisteraient et échapperaient au contrôle applicatif.
    await queryRunner.query(`
      UPDATE ressources_humaines
      SET email = LOWER(TRIM(email))
      WHERE email IS NOT NULL AND email <> LOWER(TRIM(email))
    `);

    // Les doublons préexistants sont neutralisés plutôt que supprimés :
    // on ne perd aucune donnée, la fiche la plus ancienne conserve l'email.
    const doublons = (await queryRunner.query(`
      SELECT id, email FROM (
        SELECT id, email,
               ROW_NUMBER() OVER (PARTITION BY LOWER(TRIM(email)) ORDER BY id) AS rang
        FROM ressources_humaines
        WHERE email IS NOT NULL AND TRIM(email) <> ''
      ) t WHERE rang > 1
    `)) as Array<{ id: number; email: string }>;

    for (const doublon of doublons) {
      // Suffixe traçable : l'information reste lisible pour un correctif manuel.
      await queryRunner.query(
        `UPDATE ressources_humaines SET email = $1 WHERE id = $2`,
        [`${doublon.email}.doublon-${doublon.id}`, doublon.id],
      );
    }

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_RH_EMAIL"
      ON "ressources_humaines" (email)
      WHERE email IS NOT NULL AND email <> ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "UQ_RH_EMAIL"');
  }
}
