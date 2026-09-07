import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddSlugToPartners1753200000000 implements MigrationInterface {
  name = 'AddSlugToPartners1753200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('partners'))) return;

    if (!(await queryRunner.hasColumn('partners', 'slug'))) {
      await queryRunner.addColumn(
        'partners',
        new TableColumn({
          name: 'slug',
          type: 'varchar',
          length: '255',
          isNullable: true,
        }),
      );
    }

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_PARTNERS_SLUG" ON "partners" ("slug")',
    );

    const partners = (await queryRunner.query(
      'SELECT id, nom FROM partners WHERE slug IS NULL',
    )) as Array<{ id: number; nom: string }>;
    for (const partner of partners) {
      const slug = this.generateSlug(partner.nom);
      await queryRunner.query('UPDATE partners SET slug = $1 WHERE id = $2', [slug, partner.id]);
    }

    await queryRunner.query('ALTER TABLE partners ALTER COLUMN slug SET NOT NULL');
  }

  private generateSlug(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .split('-')
      .filter(Boolean)
      .join('-');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('partners'))) return;
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_PARTNERS_SLUG"');
    if (await queryRunner.hasColumn('partners', 'slug')) {
      await queryRunner.dropColumn('partners', 'slug');
    }
  }
}
