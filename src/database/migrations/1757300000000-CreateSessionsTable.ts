import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSessionsTable1757300000000 implements MigrationInterface {
  name = 'CreateSessionsTable1757300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sessions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" integer NOT NULL,
        "refreshTokenHash" character varying(64) NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "lastActivityAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "revokedAt" TIMESTAMP WITH TIME ZONE,
        "revokedBy" integer,
        "revokedReason" character varying(100),
        "ipAddress" character varying(45),
        "deviceName" character varying(120),
        "browserName" character varying(60),
        "osName" character varying(60),
        CONSTRAINT "PK_sessions_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_sessions_refresh_token_hash" UNIQUE ("refreshTokenHash"),
        CONSTRAINT "FK_sessions_user" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_sessions_user_id" ON "sessions" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_sessions_expires_at" ON "sessions" ("expiresAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_sessions_refresh_token_hash" ON "sessions" ("refreshTokenHash")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_sessions_user_revoked_expires" ON "sessions" ("userId", "revokedAt", "expiresAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "sessions"`);
  }
}
