import { IsValidEmail } from '../../common/email/email.validators';

export class ForgotPasswordDto {
  @IsValidEmail()
  email!: string;
}
