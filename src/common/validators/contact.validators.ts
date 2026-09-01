import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export const EMAIL_MAX_LENGTH = 50;
export const PHONE_MAX_LENGTH = 25;

export function normalizeEmail(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

export function normalizePhone(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;
}

export function phoneComparisonKey(value?: string | null): string | null {
  if (!value) return null;

  const digits = value.replace(/\D/g, '');
  if (digits.length < 6) return null;
  return digits.slice(-9);
}

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

export function IsValidPhoneOptional(): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }) => {
      const normalized = normalizePhone(value);
      return normalized === '' ? undefined : normalized;
    }),
    IsOptional(),
    IsString(),
    Matches(/^\+?[\d\s()+.-]{6,}$/, {
      message: 'Numéro de téléphone invalide (exemple : +261 34 00 000 00)',
    }),
    MaxLength(PHONE_MAX_LENGTH, {
      message: `Le téléphone ne peut pas dépasser ${PHONE_MAX_LENGTH} caractères`,
    }),
  );
}
