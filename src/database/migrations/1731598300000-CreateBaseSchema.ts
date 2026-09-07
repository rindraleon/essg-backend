import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBaseSchema1731598300000 implements MigrationInterface {
  name = 'CreateBaseSchema1731598300000';

  private readonly tables = [
    `CREATE TABLE IF NOT EXISTS "formations" (
      "id" SERIAL NOT NULL,
      "slug" varchar NOT NULL,
      "domaine" text NOT NULL DEFAULT '[]',
      "titre" varchar NOT NULL,
      "niveau" text NOT NULL DEFAULT 'Licence',
      "duree" varchar NOT NULL,
      "description" text NOT NULL,
      "objectifs" text NOT NULL DEFAULT '[]',
      "debouches" text NOT NULL DEFAULT '[]',
      "conditionsAcces" text,
      "conditions" text NOT NULL DEFAULT '[]',
      "competences" text NOT NULL DEFAULT '[]',
      "modules" text NOT NULL DEFAULT '[]',
      "credits" integer NOT NULL DEFAULT 180,
      "responsable" varchar,
      "email" varchar,
      "programme" text NOT NULL DEFAULT '[]',
      "image" varchar NOT NULL DEFAULT '/images/hero-campus.jpg',
      "enVedette" boolean NOT NULL DEFAULT false,
      "creeLe" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "misAJourLe" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PK_formations" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_formations_slug" UNIQUE ("slug")
    )`,

    `CREATE TABLE IF NOT EXISTS "ressources_humaines" (
      "id" SERIAL NOT NULL,
      "slug" varchar NOT NULL,
      "nom" varchar NOT NULL,
      "prenom" varchar NOT NULL,
      "poste" varchar NOT NULL,
      "description" text,
      "email" varchar,
      "telephone" varchar,
      "photo" varchar,
      "actif" boolean NOT NULL DEFAULT true,
      "ordre" integer NOT NULL DEFAULT 0,
      "creeLe" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "misAJourLe" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PK_ressources_humaines" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_ressources_humaines_slug" UNIQUE ("slug")
    )`,

    `CREATE TABLE IF NOT EXISTS "messages" (
      "id" SERIAL NOT NULL,
      "prenom" varchar NOT NULL,
      "nom" varchar NOT NULL,
      "email" varchar NOT NULL,
      "telephone" varchar,
      "sujet" varchar NOT NULL,
      "message" text NOT NULL,
      "lu" boolean NOT NULL DEFAULT false,
      "luLe" timestamptz,
      "luPar" varchar(120),
      "reponse" text,
      "reponseSujet" varchar(200),
      "reponduLe" timestamptz,
      "reponduPar" varchar(120),
      "creeLe" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "misAJourLe" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PK_messages" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "news" (
      "id" SERIAL NOT NULL,
      "slug" varchar NOT NULL,
      "titre" varchar NOT NULL,
      "categorie" varchar NOT NULL,
      "date" varchar NOT NULL,
      "resume" text NOT NULL,
      "contenu" text NOT NULL,
      "auteur" varchar,
      "statut" boolean NOT NULL DEFAULT false,
      "image" varchar,
      "galerie" text NOT NULL DEFAULT '[]',
      "enVedette" boolean NOT NULL DEFAULT false,
      "creeLe" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "misAJourLe" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PK_news" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_news_slug" UNIQUE ("slug")
    )`,

    `CREATE TABLE IF NOT EXISTS "partners" (
      "id" SERIAL NOT NULL,
      "nom" varchar NOT NULL,
      "type" text NOT NULL DEFAULT 'Entreprise',
      "secteur" text,
      "description" text NOT NULL,
      "siteWeb" varchar,
      "logo" varchar,
      "contact" varchar,
      "dateDebut" date,
      "creeLe" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "misAJourLe" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PK_partners" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "projects" (
      "id" SERIAL NOT NULL,
      "titre" varchar NOT NULL,
      "slug" varchar,
      "type" text NOT NULL DEFAULT 'Recherche',
      "statut" text NOT NULL DEFAULT 'En cours',
      "date" varchar NOT NULL,
      "description" text NOT NULL,
      "partenaireIds" text NOT NULL DEFAULT '[]',
      "partenaires" text NOT NULL DEFAULT '[]',
      "image" varchar NOT NULL DEFAULT '/images/hero-campus.jpg',
      "galerie" text NOT NULL DEFAULT '[]',
      "latitude" numeric(10,7),
      "longitude" numeric(10,7),
      "ville" varchar,
      "pays" varchar,
      "adresse" text,
      "creeLe" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "misAJourLe" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PK_projects" PRIMARY KEY ("id")
    )`,

    `CREATE TABLE IF NOT EXISTS "activity_logs" (
      "id" SERIAL NOT NULL,
      "userId" integer,
      "action" varchar(100) NOT NULL,
      "description" text NOT NULL,
      "method" varchar(10) NOT NULL,
      "endpoint" varchar(255) NOT NULL,
      "module" varchar(100) NOT NULL,
      "statusCode" integer NOT NULL,
      "success" boolean NOT NULL,
      "ipAddress" varchar(45),
      "metadata" jsonb,
      "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PK_activity_logs" PRIMARY KEY ("id")
    )`,
  ];

  private readonly indexes = [
    `CREATE INDEX IF NOT EXISTS "IDX_MESSAGES_SUJET" ON "messages" ("sujet")`,
    `CREATE INDEX IF NOT EXISTS "IDX_MESSAGES_CREE_LE" ON "messages" ("creeLe")`,
    `CREATE INDEX IF NOT EXISTS "IDX_ACTIVITY_LOGS_USER_ID" ON "activity_logs" ("userId")`,
    `CREATE INDEX IF NOT EXISTS "IDX_ACTIVITY_LOGS_ENDPOINT" ON "activity_logs" ("endpoint")`,
    `CREATE INDEX IF NOT EXISTS "IDX_ACTIVITY_LOGS_MODULE" ON "activity_logs" ("module")`,
    `CREATE INDEX IF NOT EXISTS "IDX_ACTIVITY_LOGS_SUCCESS" ON "activity_logs" ("success")`,
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of this.tables) {
      await queryRunner.query(statement);
    }
    for (const statement of this.indexes) {
      await queryRunner.query(statement);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const names = [
      'activity_logs',
      'projects',
      'partners',
      'news',
      'messages',
      'ressources_humaines',
      'formations',
    ];
    for (const name of names) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${name}"`);
    }
  }
}
