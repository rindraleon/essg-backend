import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, MaxLength } from 'class-validator';
import { normalizePhoneNumber } from '../utils/contact.util';
import { IsValidPhoneStrictOptional } from './person.validators';

export const EMAIL_MAX_LENGTH = 50;
export const PHONE_MAX_LENGTH = 25;

export function normalizeEmail(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

export { normalizePhoneNumber };

export function IsValidEmail(): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }) => normalizeEmail(value)),
    IsEmail(
      { require_tld: true, allow_display_name: false },
      { message: 'Adresse email invalide (exemple : nom@domaine.mg)' },
    ),
    MaxLength(EMAIL_MAX_LENGTH, {
      message: `L'email ne peut pas dépasser ${EMAIL_MAX_LENGTH} caractères`,
    }),
  );
}

export function IsValidEmailOptional(): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }) => {
      const normalized = normalizeEmail(value);
      return normalized === '' ? undefined : normalized;
    }),
    IsOptional(),
    IsEmail(
      { require_tld: true, allow_display_name: false },
      { message: 'Adresse email invalide (exemple : nom@domaine.mg)' },
    ),
    MaxLength(EMAIL_MAX_LENGTH, {
      message: `L'email ne peut pas dépasser ${EMAIL_MAX_LENGTH} caractères`,
    }),
  );
}

/**
 * Téléphone optionnel : validation stricte du format (chiffres, espaces de
 * formatage, un seul « + » en tête, longueur réelle contrôlée).
 * La canonicalisation vers le format international (+261…) est faite par les
 * services après validation, afin de ne jamais « nettoyer » silencieusement
 * une saisie invalide.
 */
export function IsValidPhoneOptional(): PropertyDecorator {
  return applyDecorators(
    IsValidPhoneStrictOptional(),
    IsOptional(),
    MaxLength(PHONE_MAX_LENGTH, {
      message: `Le téléphone ne peut pas dépasser ${PHONE_MAX_LENGTH} caractères`,
    }),
  );
}
