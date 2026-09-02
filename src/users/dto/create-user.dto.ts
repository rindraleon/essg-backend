import {
  IsString,
  IsOptional,
  IsIn,
  IsBoolean,
  IsNotEmpty,
  MinLength,
  MaxLength,
} from 'class-validator';
import { IsValidEmail } from '../../common/validators/contact.validators';
import { IsValidPersonName } from '../../common/validators/person.validators';

export class CreateUtilisateurDto {
  @IsValidEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(128)
  motDePasse!: string;

  @IsValidPersonName(
    'Le nom ne peut contenir que des lettres, espaces, apostrophes ou traits d’union.'
  )
  @IsNotEmpty({ message: 'Le nom est obligatoire.' })
  @MaxLength(100)
  nom!: string;

  @IsValidPersonName(
    'Le prénom ne peut contenir que des lettres, espaces, apostrophes ou traits d’union.'
  )
  @IsNotEmpty({ message: 'Le prénom est obligatoire.' })
  @MaxLength(100)
  prenom!: string;

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
