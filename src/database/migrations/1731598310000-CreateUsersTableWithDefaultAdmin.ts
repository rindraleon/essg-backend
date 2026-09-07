import { MigrationInterface, QueryRunner, Table } from 'typeorm';
import * as bcrypt from 'bcrypt';
import {
  PASSWORD_SALT_ROUNDS,
  USERS_TABLE,
  resolveDefaultAdminCredentials,
} from '../../users/users.constants';

export class CreateUsersTableWithDefaultAdmin1731598310000 implements MigrationInterface {
  name = 'CreateUsersTableWithDefaultAdmin1731598310000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.ensureTable(queryRunner);
    await this.ensureDefaultAdmin(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const { email } = resolveDefaultAdminCredentials();
    if (!(await queryRunner.hasTable(USERS_TABLE))) return;
    await queryRunner.query(`DELETE FROM "${USERS_TABLE}" WHERE LOWER("email") = $1`, [email]);
  }

  private async ensureTable(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable(USERS_TABLE)) return;

    await queryRunner.createTable(
      new Table({
        name: USERS_TABLE,
        columns: [
          { name: 'id', type: 'serial', isPrimary: true },
          { name: 'email', type: 'varchar', length: '255', isUnique: true },
          { name: 'motDePasse', type: 'varchar', length: '255' },
          { name: 'prenom', type: 'varchar', length: '100' },
          { name: 'nom', type: 'varchar', length: '100' },
          { name: 'role', type: 'varchar', length: '20', default: `'admin'` },
          { name: 'estActif', type: 'boolean', default: true },
          { name: 'creeLe', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
          { name: 'misAJourLe', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );
  }

  private async ensureDefaultAdmin(queryRunner: QueryRunner): Promise<void> {
    const admin = resolveDefaultAdminCredentials();

    const existing = (await queryRunner.query(
      `SELECT 1 FROM "${USERS_TABLE}" WHERE LOWER("email") = $1 OR "role" = $2 LIMIT 1`,
      [admin.email, admin.role],
    )) as unknown[];
    if (existing.length > 0) return;

    const passwordHash = await bcrypt.hash(admin.password, PASSWORD_SALT_ROUNDS);
    await queryRunner.query(
      `INSERT INTO "${USERS_TABLE}" ("email", "motDePasse", "prenom", "nom", "role", "estActif")
       VALUES ($1, $2, $3, $4, $5, true)
       ON CONFLICT ("email") DO NOTHING`,
      [admin.email, passwordHash, admin.prenom, admin.nom, admin.role],
    );
  }
}
