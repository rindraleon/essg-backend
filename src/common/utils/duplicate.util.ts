import { ConflictException } from '@nestjs/common';
import { Not, type Repository } from 'typeorm';
import { normalizeEmail, phoneComparisonKey } from '../validators/contact.validators';

export interface DuplicateCheckOptions {
  excludeId?: number;
}

export async function assertEmailIsAvailable<T extends object>(
  repo: Repository<T>,
  email: string | undefined,
  label: string,
  options: DuplicateCheckOptions = {},
): Promise<void> {
  const normalized = normalizeEmail(email);
  if (typeof normalized !== 'string' || !normalized) return;

  const where: Record<string, unknown> = { email: normalized };
  if (options.excludeId !== undefined) {
    where.id = Not(options.excludeId);
  }

  const existing = await repo.findOne({
    where: where as never,
    select: ['id'] as never,
  });

  if (existing) {
    throw new ConflictException(`Cette adresse email est déjà utilisée par ${label}.`);
  }
}

export async function assertPhoneIsAvailable<T extends { id: number; telephone?: string }>(
  repo: Repository<T>,
  telephone: string | undefined,
  label: string,
  options: DuplicateCheckOptions = {},
): Promise<void> {
  const key = phoneComparisonKey(telephone);
  if (!key) return;

  const candidates = await repo.find({
    select: ['id', 'telephone'] as never,
  });

  const conflict = candidates.some(
    (item) => item.id !== options.excludeId && phoneComparisonKey(item.telephone) === key,
  );

  if (conflict) {
    throw new ConflictException(`Ce numéro de téléphone est déjà utilisé par ${label}.`);
  }
}
