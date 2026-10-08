import { BadRequestException, ConflictException } from '@nestjs/common';
import { type Repository } from 'typeorm';
import { slugify } from '../common/utils/text.util';
import { QueryFailedError } from 'typeorm';

export function baseSlug(source: string): string {
  return slugify(source) || 'element';
}


export async function buildScopedUniqueSlug<T extends object>(
  repo: Repository<T>,
  source: string,
  scope: Record<string, unknown>,
  options: { excludeId?: number } = {},
): Promise<string> {
  const base = baseSlug(source);
  let candidate = base;
  for (let suffix = 2; suffix <= 51; suffix += 1) {
    const qb = repo
      .createQueryBuilder('item')
      .select('item.id', 'id')
      .where('item.slug = :candidate', { candidate });

    for (const [column, value] of Object.entries(scope)) {
      qb.andWhere(`item.${column} = :scope_${column}`, { [`scope_${column}`]: value });
    }
    if (options.excludeId !== undefined) {
      qb.andWhere('item.id <> :excludeId', { excludeId: options.excludeId });
    }

    const existing = await qb.getRawOne<{ id: string }>();
    if (!existing) return candidate;
    candidate = `${base}-${suffix}`;
  }
  return `${base}-${Date.now()}`;
}

/** Refuse les doublons (après normalisation) dans une liste de noms saisis. */
export function assertNoDuplicateNames(items: { nom: string }[], label: string): void {
  const seen = new Set<string>();
  for (const item of items) {
    const key = baseSlug(item.nom);
    if (seen.has(key)) {
      throw new BadRequestException(
        `Le ${label.toLowerCase()} « ${item.nom} » est saisi plusieurs fois.`,
      );
    }
    seen.add(key);
  }
}

/** Traduit une contrainte d'unicité PostgreSQL en conflit explicite. */
export function rethrowUnique(error: unknown, message: string): void {
  if (error instanceof QueryFailedError) {
    const code = (error.driverError as { code?: string } | undefined)?.code;
    if (code === '23505') {
      throw new ConflictException(message);
    }
    if (code === '23503') {
      throw new ConflictException(
        'Cette opération est bloquée par des données dépendantes (formations ou parcours associés).',
      );
    }
  }
}
