import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { IsValidEmail } from '../../common/email/email.validators';

export class LoginDto {
  @IsValidEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  password!: string;
}
