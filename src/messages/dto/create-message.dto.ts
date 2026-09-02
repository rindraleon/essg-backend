import { IsString, IsOptional, IsBoolean, MaxLength, IsNotEmpty } from 'class-validator';
import { IsValidEmail, IsValidPhoneOptional } from '../../common/validators/contact.validators';
import { IsValidPersonName } from '../../common/validators/person.validators';

export class CreateMessageDto {
  @IsValidPersonName(
    'Le nom ne peut contenir que des lettres, espaces, apostrophes ou traits d’union.',
  )
  @IsNotEmpty({ message: 'Le nom est obligatoire.' })
  @MaxLength(100)
  nom!: string;

  @IsOptional()
  @IsValidPersonName(
    'Le prénom ne peut contenir que des lettres, espaces, apostrophes ou traits d’union.',
  )
  @MaxLength(100)
  prenom?: string;

  @IsValidEmail()
  email!: string;

  @IsValidPhoneOptional()
  telephone?: string;

  @IsString()
  @IsNotEmpty({ message: 'Le sujet est obligatoire.' })
  @MaxLength(100)
  sujet!: string;

  @IsString()
  @IsNotEmpty({ message: 'Le message est obligatoire.' })
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
