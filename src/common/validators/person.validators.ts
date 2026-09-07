import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  IsString,
  Validate,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';

const INTERNATIONAL_MIN_DIGITS = 8;
const INTERNATIONAL_MAX_DIGITS = 15;

export const DIPLOMA_YEAR_MIN = 1980;

export function currentYear(): number {
  return new Date().getFullYear();
}

export const PERSON_NAME_REGEX = /^\p{L}(?:[\p{L}'’ -]*\p{L})?$/u;

export const PLACE_NAME_REGEX = /^\p{L}(?:[\p{L}'’ ,.-]*[\p{L}.])?$/u;

export const BAC_NUMBER_REGEX = /^\d{4,20}$/;

export const YEAR_4_DIGITS_REGEX = /^\d{4}$/;

function trimTransform() {
  return Transform(({ value }) => (typeof value === 'string' ? value.trim() : undefined));
}

@ValidatorConstraint({ name: 'personName', async: false })
class PersonNameConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!trimmed) return true;
    return PERSON_NAME_REGEX.test(trimmed);
  }

  defaultMessage(): string {
    return 'Le nom ne peut contenir que des lettres, espaces, apostrophes ou traits d’union.';
  }
}

@ValidatorConstraint({ name: 'placeName', async: false })
class PlaceNameConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!trimmed) return true;
    return PLACE_NAME_REGEX.test(trimmed);
  }

  defaultMessage(): string {
    return 'Ce champ doit être un nom de lieu valide (lettres, espaces, apostrophes, traits d’union).';
  }
}

@ValidatorConstraint({ name: 'bacNumber', async: false })
class BacNumberConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!trimmed) return true;
    return BAC_NUMBER_REGEX.test(trimmed);
  }

  defaultMessage(): string {
    return 'Le numéro du baccalauréat doit contenir uniquement des chiffres (4 à 20 chiffres).';
  }
}

@ValidatorConstraint({ name: 'diplomaYear', async: false })
class DiplomaYearConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!trimmed) return true;
    if (!YEAR_4_DIGITS_REGEX.test(trimmed)) return false;
    const year = Number(trimmed);
    return year >= DIPLOMA_YEAR_MIN && year <= currentYear();
  }

  defaultMessage(): string {
    return `L’année doit être composée de 4 chiffres, comprise entre ${DIPLOMA_YEAR_MIN} et ${currentYear()}.`;
  }
}

@ValidatorConstraint({ name: 'phoneNumber', async: false })
class PhoneNumberConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    const compact = value.replace(/\s+/g, '');
    if (!compact) return false;
    if (!/^\+?\d+$/.test(compact)) return false;
    if (compact.startsWith('+')) return isValidInternationalDigits(compact.slice(1));
    if (compact.startsWith('00')) {
      const rest = compact.slice(2);
      return /^\d+$/.test(rest) && isValidInternationalDigits(rest);
    }
    return /^0[2-9]\d{8}$/.test(compact);
  }

  defaultMessage(): string {
    return 'Numéro de téléphone invalide (exemples : 032 12 345 67 ou +261 32 12 345 67)';
  }
}

function isValidInternationalDigits(digits: string): boolean {
  if (digits.length < INTERNATIONAL_MIN_DIGITS || digits.length > INTERNATIONAL_MAX_DIGITS) {
    return false;
  }
  if (digits.startsWith('261')) return /^261[2-9]\d{8}$/.test(digits);
  return true;
}

export function IsValidPersonName(message?: string): PropertyDecorator {
  return applyDecorators(
    trimTransform(),
    IsString(),
    Validate(PersonNameConstraint, message ? { message } : undefined),
  );
}

export function IsValidPlaceName(message?: string): PropertyDecorator {
  return applyDecorators(
    trimTransform(),
    IsString(),
    Validate(PlaceNameConstraint, message ? { message } : undefined),
  );
}

export function IsValidBacNumber(message?: string): PropertyDecorator {
  return applyDecorators(
    trimTransform(),
    IsString(),
    Validate(BacNumberConstraint, message ? { message } : undefined),
  );
}

export function IsValidDiplomaYear(message?: string): PropertyDecorator {
  return applyDecorators(
    trimTransform(),
    IsString(),
    Validate(DiplomaYearConstraint, message ? { message } : undefined),
  );
}

export function IsValidPhoneStrictOptional(): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }) =>
      typeof value === 'string' && value.trim() ? value.trim().replace(/\s+/g, ' ') : undefined,
    ),
    Validate(PhoneNumberConstraint),
  );
}
