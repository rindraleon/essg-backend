import { MigrationExecutor } from 'typeorm';
import dataSource from './data-source';

async function baseline(): Promise<void> {
  await dataSource.initialize();
  try {
    const executor = new MigrationExecutor(dataSource);
    const migrations = await executor.getAllMigrations();
    console.log(`${migrations.length} migration(s) trouvée(s) dans le code source.`);
    if (migrations.length === 0) {
      console.error('Aucune migration trouvée — baseline annulé.');
      process.exit(1);
    }

    await dataSource.query(
      `CREATE TABLE IF NOT EXISTS "migrations" (
        "id" SERIAL PRIMARY KEY,
        "timestamp" bigint NOT NULL,
        "name" varchar NOT NULL
      )`,
    );

    let inserted = 0;
    for (const migration of migrations) {
      const existing: unknown[] = await dataSource.query(
        `SELECT 1 FROM "migrations" WHERE "name" = $1`,
        [migration.name],
      );

      if (existing.length === 0) {
        await dataSource.query(`INSERT INTO "migrations" ("timestamp", "name") VALUES ($1, $2)`, [
          migration.timestamp,
          migration.name,
        ]);
        inserted += 1;
        console.log(`baseline: ${migration.name} marquée comme appliquée`);
      } else {
        console.log(`baseline: ${migration.name} déjà présente`);
      }
    }
    console.log(
      `Baseline terminée (${inserted} migration(s) ajoutée(s) sur ${migrations.length}).`,
    );
  } finally {
    await dataSource.destroy();
  }
}

baseline().catch((error: unknown) => {
  console.error('Échec du baseline des migrations :', error);
  process.exit(1);
});
