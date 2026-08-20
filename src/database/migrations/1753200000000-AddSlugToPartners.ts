import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddSlugToPartners1753200000000 implements MigrationInterface {
  name = 'AddSlugToPartners1753200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Étape 1 : Ajouter la colonne slug comme nullable (pas de contrainte NOT NULL)
    await queryRunner.addColumn(
      'partners',
      new TableColumn({
        name: 'slug',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    );

    // Créer un index sur la colonne slug pour améliorer les performances
    await queryRunner.createIndex(
      'partners',
      new TableIndex({
        name: 'IDX_PARTNERS_SLUG',
        columnNames: ['slug'],
      }),
    );

    // Étape 2 : Peupler les slugs pour les données existantes
    const partners = (await queryRunner.query(
      'SELECT id, nom FROM partners WHERE slug IS NULL',
    )) as Array<{ id: number; nom: string }>;
    for (const partner of partners) {
      const slug = this.generateSlug(partner.nom);
      await queryRunner.query('UPDATE partners SET slug = $1 WHERE id = $2', [slug, partner.id]);
    }

    // Étape 3 : Rendre la colonne NOT NULL
    await queryRunner.query('ALTER TABLE partners ALTER COLUMN slug SET NOT NULL');
  }

  private generateSlug(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('partners', 'IDX_PARTNERS_SLUG');
    await queryRunner.dropColumn('partners', 'slug');
  }
}
