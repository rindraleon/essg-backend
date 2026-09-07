import { applyDecorators } from '@nestjs/common';
import { IsOptional, MaxLength } from 'class-validator';
import { normalizePhoneNumber } from '../utils/contact.util';
import { IsValidPhoneStrictOptional } from './person.validators';

export {
  EMAIL_MAX_LENGTH,
  normalizeEmail,
  isValidEmail,
  isDisposableEmail,
} from '../email/email-format.util';
export { IsValidEmail, IsValidEmailOptional } from '../email/email.validators';
export { normalizePhoneNumber };

export const PHONE_MAX_LENGTH = 25;

export function IsValidPhoneOptional(): PropertyDecorator {
  return applyDecorators(
    IsValidPhoneStrictOptional(),
    IsOptional(),
    MaxLength(PHONE_MAX_LENGTH, {
      message: `Le téléphone ne peut pas dépasser ${PHONE_MAX_LENGTH} caractères`,
    }),
  );
}
