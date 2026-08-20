import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(50)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  password!: string;
}
