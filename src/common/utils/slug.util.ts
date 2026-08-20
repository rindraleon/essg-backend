import { Repository, Not } from 'typeorm';
import { slugify } from './text.util';

export interface UniqueSlugOptions {
  excludeId?: number;
  column?: string;
  idColumn?: string;
}

export async function buildUniqueSlug<T extends object>(
  repo: Repository<T>,
  source: string,
  options: UniqueSlugOptions = {},
): Promise<string> {
  const { excludeId, column = 'slug', idColumn = 'id' } = options;

  const base = slugify(source) || 'element';
  let candidate = base;
  let suffix = 1;

  // Boucle bornée : au-delà de 50 collisions on bascule sur un suffixe temporel.
  while (suffix <= 50) {
    const where: Record<string, unknown> = { [column]: candidate };
    if (excludeId !== undefined) {
      where[idColumn] = Not(excludeId);
    }

    const existing = await repo.findOne({
      where: where as never,
      select: [idColumn] as never,
    });

    if (!existing) {
      return candidate;
    }

    suffix += 1;
    candidate = `${base}-${suffix}`;
  }

  return `${base}-${Date.now()}`;
}

export function shouldRegenerateSlug(
  currentSource: string | undefined,
  nextSource: string | undefined,
  currentSlug: string | undefined,
): boolean {
  if (!currentSlug) return true;
  if (!nextSource) return false;
  return slugify(nextSource) !== slugify(currentSource ?? '');
}
