import {
  IsString,
  IsOptional,
  IsIn,
  IsBoolean,
  MinLength,
  MaxLength,
} from 'class-validator';
import { IsValidEmail } from '../../common/validators/contact.validators';

export class CreateUtilisateurDto {
  @IsValidEmail()
  email: string;

  @IsString()
  @MinLength(6)
  @MaxLength(128)
  motDePasse: string;

  @IsString()
  @MaxLength(100)
  prenom: string;

  @IsString()
  @MaxLength(100)
  nom: string;

  @IsIn(['admin', 'editeur', 'lecteur'])
  @IsOptional()
  role?: 'admin' | 'editeur' | 'lecteur';

  @IsBoolean()
  @IsOptional()
  estActif?: boolean;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  avatar?: string;
}
