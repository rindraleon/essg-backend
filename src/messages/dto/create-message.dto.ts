import { IsString, IsOptional, IsBoolean, MaxLength, IsNotEmpty } from 'class-validator';
import {
  IsValidEmail,
  IsValidPhoneOptional,
} from '../../common/validators/contact.validators';

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  prenom!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nom!: string;

  @IsValidEmail()
  email!: string;

  @IsValidPhoneOptional()
  telephone?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  sujet!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  message!: string;

  @IsBoolean()
  @IsOptional()
  lu?: boolean;
}

export class UpdateMessageDto {
  @IsBoolean()
  lu!: boolean;
}
