# Backend ESSG — API signée ITDCMADA

<div align="center">

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org)
[![NestJS](https://img.shields.io/badge/NestJS-Framework-red)](https://nestjs.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-316192)](https://www.postgresql.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Backend NestJS + PostgreSQL + MinIO — éditeur ITDCMADA**

*API REST scalable et sécurisée générée avec @hiqaody/create-backend-pg*

</div>

---

## 📋 Table des Matières

- [À Propos](#-à-propos)
- [Prérequis](#-prérequis)
- [Installation](#-installation)
- [Configuration](#️-configuration)
- [Démarrage](#-démarrage)
- [Structure du Projet](#-structure-du-projet)
- [Commandes Disponibles](#-commandes-disponibles)
- [Développement](#-développement)
- [Tests](#-tests)
- [Déploiement](#-déploiement)
- [API Documentation](#-api-documentation)
- [Architecture (PostgreSQL · MinIO · SMTP)](#-architecture-postgresql--minio--smtp)
- [Signature ITDCMADA & enveloppe de réponse](#-signature-itdcmada--enveloppe-de-réponse)
- [Pipeline d'images WebP](#-pipeline-dimages-webp)
- [Supervision (health)](#-supervision-health)

---

## 📖 À Propos

Ce projet est un backend API REST développé avec NestJS et PostgreSQL. Il inclut :

- ✅ Architecture modulaire NestJS
- ✅ Base de données PostgreSQL avec TypeORM
- ✅ Validation des données avec class-validator
- ✅ Configuration centralisée avec variables d'environnement
- ✅ Sécurité (Helmet, CORS, Rate Limiting)
- ✅ Tests unitaires et E2E avec Jest
- ✅ Hot reload en développement
- ✅ ESLint + Prettier configurés
- ✅ Docker ready pour déploiement

---

## 🔧 Prérequis

Avant de commencer, assurez-vous d'avoir installé :

- **Node.js** >= 20.0.0 ([Télécharger](https://nodejs.org))
- **npm** >= 9.0.0 (inclus avec Node.js)
- **PostgreSQL** >= 12 ([Télécharger](https://www.postgresql.org/download/))
- **Git** ([Télécharger](https://git-scm.com/downloads))

---

## 📦 Installation

### 1. Cloner le repository

```bash
git clone <votre-repo-url>
cd mon-api
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configurer les variables d'environnement

```bash
cp .env.example .env
```

Éditez le fichier `.env` avec vos paramètres :

```env
# Application
NODE_ENV=development
APP_PORT=3000
APP_HOST=localhost

# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=votre_mot_de_passe
POSTGRES_DB=mon_api_db

# JWT
JWT_SECRET=votre_secret_jwt_securise
JWT_EXPIRES_IN=1h
```

### 4. Créer la base de données

```bash
# Avec psql
createdb mon_api_db

# Ou via PostgreSQL
psql -U postgres
CREATE DATABASE mon_api_db;
\q
```

---

## ⚙️ Configuration

### Variables d'environnement

| Variable | Description | Valeur par défaut |
|----------|-------------|-------------------|
| `NODE_ENV` | Environnement d'exécution | `development` |
| `APP_PORT` | Port de l'application | `3000` |
| `APP_HOST` | Hôte de l'application | `localhost` |
| `POSTGRES_HOST` | Hôte PostgreSQL | `localhost` |
| `POSTGRES_PORT` | Port PostgreSQL | `5432` |
| `POSTGRES_USER` | Utilisateur PostgreSQL | `postgres` |
| `POSTGRES_PASSWORD` | Mot de passe PostgreSQL | - |
| `POSTGRES_DB` | Nom de la base de données | `mon_api_db` |
| `JWT_SECRET` | Secret pour JWT | - |
| `JWT_EXPIRES_IN` | Durée de validité du JWT | `1h` |

### Configuration TypeORM

Le projet utilise TypeORM pour la gestion de la base de données. La configuration se trouve dans `src/database/database.module.ts`.

**Mode développement :**
- `synchronize: true` - Les entités sont synchronisées automatiquement
- `logging: true` - Les requêtes SQL sont affichées

**Mode production :**
- `synchronize: false` - Utilisez les migrations
- `logging: false` - Logs désactivés pour les performances

---

## 🚀 Démarrage

### Développement

```bash
# Démarrer en mode développement avec hot-reload
npm run start:dev
```

L'API sera accessible sur `http://localhost:3000`

### Production

```bash
# Build le projet
npm run build

# Démarrer en mode production
npm run start:prod
```

### Vérifier que l'API fonctionne

```bash
# Carte d'identité de l'API (éditeur, version, liens utiles)
curl http://localhost:3000
# → {"statusCode":200,…,"data":{"name":"API ESSG — ITDCMADA",…},"signature":"ITDCMADA",…}

# État de santé complet : PostgreSQL + MinIO + mémoire
curl http://localhost:3000/health

# Sondes dédiées (Docker / Kubernetes)
curl http://localhost:3000/health/live
curl -i http://localhost:3000/health/ready   # 503 si la base est injoignable

# Documentation interactive
open http://localhost:3000/docs              # Swagger UI
curl http://localhost:3000/docs-json         # schéma OpenAPI
```

---

## 🧩 Architecture (PostgreSQL · MinIO · SMTP)

```text
NestJS ──► PostgreSQL (données)
       ├─► MinIO (fichiers)
       └─► SMTP (emails)
```

Le cache et les quotas sont gérés localement en mémoire. Les emails sont envoyés directement par le service SMTP.

### Démarrer les dépendances

```bash
# Pile complète
docker compose up -d --build

# PostgreSQL + MinIO uniquement, API lancée avec npm
docker compose up -d postgres minio
```

📖 Détail complet : **[`documentation/architecture.md`](documentation/architecture.md)**

---

## 🔏 Signature ITDCMADA & enveloppe de réponse

Toutes les réponses de l'API — succès **comme** erreurs — sont signées par l'éditeur **ITDCMADA** :

* champ `signature` dans le corps JSON ;
* en-têtes HTTP `X-Api-Signature: ITDCMADA` et `X-Api-Version` (exposés via CORS) ;
* mention dans le schéma OpenAPI (`info["x-api-signature"]`) et bandeau dans Swagger UI.

```jsonc
{
  "statusCode": 200,
  "message": "Formations récupérées",
  "data": [ /* … */ ],
  "meta": { "total": 42, "page": 1, "limit": 10, "totalPages": 5 },
  "signature": "ITDCMADA",
  "timestamp": "2026-08-21T09:30:00.000Z",
  "path": "/formations?page=1"
}
```

Les champs historiques (`statusCode`, `message`, `data`, `meta`) sont inchangés : les clients
existants ne sont pas impactés.

📖 Détails complets : **[`docs/API.md`](docs/API.md)** · Documentation interactive : `GET /docs`

---

## 🖼️ Pipeline d'images WebP

Toutes les images reçues du Back-Office passent par un pipeline unique (Sharp) :

```text
Upload → validation (MIME + magic bytes) → Sharp (EXIF, resize, WebP)
      → MinIO → vérification de l'objet → URL /media/<dossier>/<uuid>.webp → base de données
```

* code centralisé : `src/common/images/` (`ImageOptimizerService`, `ImageUploadService`) ;
* aucune logique Sharp dupliquée dans les services métier ;
* l'original n'est jamais conservé, seul le WebP est stocké ;
* aucune URL n'est enregistrée en base si le stockage échoue (`503`) ;
* l'ancienne image est supprimée **après** le succès du remplacement ;
* presets par usage : `avatar` 512px/q82, `logo` 800px/q86, `staff` 900×1200/q82,
  `cover` 1920×1080/q80, `gallery` 1600px/q78, `default` 1920px/q80.

Endpoints : `POST /users/{id}/avatar`, `POST|PUT /partners`, `POST /upload/image?folder=…`.

---

## 🩺 Supervision (health)

| Route | Rôle | Codes |
| --- | --- | --- |
| `GET /health` | Rapport complet : PostgreSQL, MinIO, mémoire | `200` |
| `GET /health/live` | Vivacité du process (liveness) | `200` |
| `GET /health/ready` | Disponibilité (readiness) | `200` / `503` |

`status` global : `ok` (tout est vert), `degraded` (une dépendance est tombée),
`down` (base **et** stockage indisponibles). Seuil mémoire configurable via
`HEALTH_MEMORY_LIMIT_MB` (512 Mo par défaut).

---

## 📁 Structure du Projet

```
mon-api/
├── 📂 src/
│   ├── 📂 database/                  # Module base de données
│   │   ├── database.module.ts
│   ├── 📂 common/                    # Utilitaires partagés
│   │   ├── decorators/
│   │   ├── filters/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   └── pipes/
│   ├── 📂 users/                     # Exemple module (nest g resource)
│   │   ├── 📂 dto/
│   │   │   ├── create-user.dto.ts
│   │   │   └── update-user.dto.ts
│   │   ├── 📂 entities/
│   │   │   └── user.entity.ts
│   │   ├── users.controller.ts
│   │   ├── users.controller.spec.ts
│   │   ├── users.service.ts
│   │   ├── users.service.spec.ts
│   │   └── users.module.ts
│   ├── app.module.ts                 # Module racine
│   ├── app.controller.ts
│   ├── app.service.ts
│   └── main.ts                       # Point d'entrée
├── 📂 test/
│   ├── app.e2e-spec.ts
│   ├── jest-e2e.json
│   └── setup.ts
├── .env                              # Variables d'environnement
├── .env.example                      # Template de configuration
├── .gitignore
├── .prettierrc
├── eslint.config.mjs
├── nest-cli.json
├── Dockerfile
├── package.json
├── tsconfig.json
├── tsconfig.build.json
└── README.md
```

---

## 🛠️ Commandes Disponibles

### Développement

```bash
# Démarrer le serveur de développement
npm run start:dev

# Démarrer en mode debug
npm run start:debug

# Démarrer en mode production
npm run start:prod
```

### Build

```bash
# Compiler le projet
npm run build

# Nettoyer et recompiler
npm run build:clean
```

### Code Quality

```bash
# Formater le code avec Prettier
npm run format

# Vérifier le code avec ESLint
npm run lint

# Corriger automatiquement les erreurs ESLint
npm run lint:fix
```

### Tests

```bash
# Lancer les tests unitaires
npm test

# Tests en mode watch
npm run test:watch

# Tests avec couverture de code
npm run test:cov

# Tests E2E
npm run test:e2e

# Tests en mode debug
npm run test:debug
```

### Base de données

```bash
# Générer une migration
npm run typeorm migration:generate -- -n NomDeLaMigration

# Exécuter les migrations
npm run typeorm migration:run

# Annuler la dernière migration
npm run typeorm migration:revert

# Afficher les migrations
npm run typeorm migration:show
```

---

## 💻 Développement

### Créer un nouveau module

```bash
# Générer un module CRUD complet
nest g resource users

# Options :
# - REST API
# - GraphQL (code first)
# - GraphQL (schema first)
# - Microservice (non-HTTP)
# - WebSockets
```

Cela génère automatiquement :
- Controller avec endpoints CRUD
- Service avec méthodes CRUD
- Module
- DTOs (Create, Update)
- Entity
- Tests unitaires

### Exemple : Module Users

```bash
nest g resource users
? What transport layer do you use? REST API
? Would you like to generate CRUD entry points? Yes
```

**Fichiers créés :**
```
src/users/
├── dto/
│   ├── create-user.dto.ts
│   └── update-user.dto.ts
├── entities/
│   └── user.entity.ts
├── users.controller.ts
├── users.controller.spec.ts
├── users.service.ts
├── users.service.spec.ts
└── users.module.ts
```

### Créer une entité TypeORM

```typescript
// src/users/entities/user.entity.ts
import { 
  Entity, 
  Column, 
  PrimaryGeneratedColumn, 
  CreateDateColumn, 
  UpdateDateColumn 
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ nullable: true })
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### Créer un DTO avec validation

```typescript
// src/users/dto/create-user.dto.ts
import { 
  IsEmail, 
  IsString, 
  MinLength, 
  MaxLength, 
  IsOptional 
} from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  firstName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  lastName?: string;
}
```

### Implémenter le service

```typescript
// src/users/users.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const user = this.usersRepository.create(createUserDto);
    return await this.usersRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    return await this.usersRepository.find();
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User #${id} not found`);
    }
    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    Object.assign(user, updateUserDto);
    return await this.usersRepository.save(user);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.usersRepository.remove(user);
  }
}
```

---

## 🧪 Tests

### Tests unitaires

```bash
# Lancer tous les tests
npm test

# Tests en mode watch
npm run test:watch

# Tests avec couverture
npm run test:cov
```

### Tests E2E

```bash
# Lancer les tests E2E
npm run test:e2e
```

**Exemple de test E2E :**

```typescript
// test/users.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('UsersController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/users (GET)', () => {
    return request(app.getHttpServer())
      .get('/users')
      .expect(200)
      .expect('Content-Type', /json/);
  });

  it('/users (POST)', () => {
    return request(app.getHttpServer())
      .post('/users')
      .send({
        email: 'test@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe'
      })
      .expect(201)
      .expect('Content-Type', /json/);
  });

  afterAll(async () => {
    await app.close();
  });
});
```

---

## 🐳 Déploiement

### Avec Docker

**1. Build l'image Docker**

```bash
docker build -t mon-api:latest .
```

**2. Lancer le conteneur**

```bash
docker run -d \
  --name mon-api \
  -p 3000:3000 \
  --env-file .env \
  mon-api:latest
```

### Avec Docker Compose

```bash
# Démarrer tous les services (app + PostgreSQL)
docker-compose up -d

# Voir les logs
docker-compose logs -f

# Arrêter les services
docker-compose down
```

**docker-compose.yml**

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    ports:
      - "${POSTGRES_PORT}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build: .
    ports:
      - "${APP_PORT}:3000"
    environment:
      NODE_ENV: production
      POSTGRES_HOST: postgres
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

volumes:
  postgres_data:
```

### Déploiement sur serveur

**1. Préparer le serveur**

```bash
# Installer Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Installer PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib

# Installer PM2 pour gérer le processus
sudo npm install -g pm2
```

**2. Déployer l'application**

```bash
# Cloner le projet
git clone <votre-repo-url>
cd mon-api

# Installer les dépendances
npm ci --production

# Build
npm run build

# Lancer avec PM2
pm2 start dist/main.js --name mon-api

# Sauvegarder la configuration PM2
pm2 save
pm2 startup
```

---

## 📖 API Documentation

La documentation complète et à jour est générée automatiquement par NestJS/Swagger :

| Ressource | URL | Contenu |
| --- | --- | --- |
| Swagger UI | `http://localhost:3000/docs` | Documentation interactive (« Try it out », authentification persistante) |
| Schéma OpenAPI | `http://localhost:3000/docs-json` | JSON, exploitable par Postman / Insomnia / génération de clients |
| Schéma OpenAPI | `http://localhost:3000/docs-yaml` | YAML |
| Guide détaillé | [`docs/API.md`](docs/API.md) | Signature, enveloppe, erreurs, pipeline WebP, health, référence des routes |

**Ce qui est documenté pour chaque endpoint :** résumé, description fonctionnelle, paramètres,
corps de requête (y compris `multipart/form-data` pour les images), schéma de réponse complet
**avec le champ `signature: "ITDCMADA"`**, et l'ensemble des erreurs possibles (400/401/403/404/409/503/500).

Le plugin Swagger de NestJS est activé dans `nest-cli.json` : les DTO et entités sont introspectés
automatiquement (types, contraintes `class-validator`, commentaires JSDoc) — inutile de dupliquer
les `@ApiProperty`.

### S'authentifier dans Swagger

1. `POST /auth/login` → copier `data.accessToken` ;
2. bouton **Authorize** (cadenas en haut à droite) → coller le jeton ;
3. les routes 🔒 sont utilisables directement depuis l'interface.

### Regroupement des endpoints

`Santé & supervision`, `Authentification`, `Utilisateurs`, `Formations`, `Projets`, `Actualités`,
`Partenaires`, `Ressources humaines`, `Admissions`, `Messages de contact`, `Tableau de bord`,
`Journal d'activité`, `Paramètres`, `Upload & médias`.

---

## 🔧 Dépannage

### Erreur de connexion PostgreSQL

**Problème :** `ECONNREFUSED` ou `password authentication failed`

**Solutions :**

```bash
# Vérifier que PostgreSQL est démarré
sudo systemctl status postgresql
sudo systemctl start postgresql

# Tester la connexion
psql -h localhost -U postgres -d mon_api_db

# Vérifier les credentials dans .env
cat .env | grep POSTGRES
```

### Port déjà utilisé

**Problème :** `EADDRINUSE: address already in use`

**Solutions :**

```bash
# Trouver le processus
lsof -i :3000

# Tuer le processus
kill -9 <PID>

# Ou changer le port dans .env
APP_PORT=3001
```

### Erreur de migration

**Problème :** Migrations qui échouent

**Solutions :**

```bash
# Réinitialiser la base
npm run db:reset

# Ou manuellement
dropdb mon_api_db
createdb mon_api_db
npm run typeorm migration:run
```

### Problèmes de build

**Problème :** Erreurs TypeScript lors du build

**Solutions :**

```bash
# Nettoyer le cache
rm -rf dist node_modules package-lock.json

# Réinstaller
npm install

# Rebuild
npm run build
```

---

## 📚 Ressources

### Documentation
- [NestJS Documentation](https://docs.nestjs.com)
- [TypeORM Documentation](https://typeorm.io)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

### Guides utiles
- [NestJS Best Practices](https://github.com/nestjs/nest/blob/master/CONTRIBUTING.md)
- [TypeORM Migrations](https://typeorm.io/migrations)
- [Testing NestJS](https://docs.nestjs.com/fundamentals/testing)

---

## 🤝 Contribution

Les contributions sont les bienvenues !

1. Fork le projet
2. Créez votre branche (`git checkout -b feature/amazing-feature`)
3. Committez vos changements (`git commit -m 'Add: amazing feature'`)
4. Push vers la branche (`git push origin feature/amazing-feature`)
5. Ouvrez une Pull Request

---

## 📝 Licence

Ce projet est sous licence MIT.

---

## 👨‍💻 Auteur

**Votre Nom**

- Email: votre.email@example.com
- GitHub: [@votre-username](https://github.com/votre-username)

---

<div align="center">

**Généré avec ❤️ par [@hiqaody/create-backend-pg](https://github.com/HiQaody/create-backend-pg)**

</div>