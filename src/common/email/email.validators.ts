import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, Validate, ValidatorConstraint } from 'class-validator';
import type { ValidatorConstraintInterface } from 'class-validator';
import { applyDecorators } from '@nestjs/common';
import {
  EMAIL_ERROR_MESSAGES,
  EMAIL_MAX_LENGTH,
  isDisposableEmail,
  isValidEmail,
  normalizeEmail,
} from './email-format.util';

@ValidatorConstraint({ name: 'emailFormat', async: false })
export class EmailFormatConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isValidEmail(value);
  }

  defaultMessage(): string {
    return EMAIL_ERROR_MESSAGES.invalid;
  }
}

@ValidatorConstraint({ name: 'emailNotDisposable', async: false })
export class EmailNotDisposableConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value !== 'string' || !isDisposableEmail(value);
  }

  defaultMessage(): string {
    return EMAIL_ERROR_MESSAGES.disposable;
  }
}

const normalizeTransform = Transform(({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? normalizeEmail(value) : value,
);

export function IsValidEmail(): PropertyDecorator {
  return applyDecorators(
    normalizeTransform,
    IsString({ message: EMAIL_ERROR_MESSAGES.invalid }),
    MaxLength(EMAIL_MAX_LENGTH, { message: EMAIL_ERROR_MESSAGES.tooLong }),
    Validate(EmailFormatConstraint),
    Validate(EmailNotDisposableConstraint),
  );
}

export function IsValidEmailOptional(): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }: { value: unknown }): unknown => {
      if (typeof value !== 'string') return value;
      const normalized = normalizeEmail(value);
      return normalized === '' ? undefined : normalized;
    }),
    IsOptional(),
    IsString({ message: EMAIL_ERROR_MESSAGES.invalid }),
    MaxLength(EMAIL_MAX_LENGTH, { message: EMAIL_ERROR_MESSAGES.tooLong }),
    Validate(EmailFormatConstraint),
    Validate(EmailNotDisposableConstraint),
  );
}
