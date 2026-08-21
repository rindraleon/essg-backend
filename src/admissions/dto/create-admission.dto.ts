import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  MaxLength,
  IsNotEmpty,
  Matches,
} from 'class-validator';
import { IsValidEmail, IsValidPhoneOptional } from '../../common/validators/contact.validators';
import { AdmissionStatus } from '../entities/admission.entity';

export const ADMISSION_NIVEAUX = ['licence', 'master', 'doctorat'] as const;
export type AdmissionNiveau = (typeof ADMISSION_NIVEAUX)[number];

export class CreateAdmissionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nom: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  prenom: string;

  @IsValidEmail()
  email: string;

  @IsValidPhoneOptional()
  telephone?: string;

  @IsDateString()
  dateNaissance: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  niveau: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  formation: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  diplomePrecedent: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  adresse?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9\-_/.\s]+$/, {
    message: "Le numéro d'inscription au baccalauréat contient des caractères invalides",
  })
  @MaxLength(100)
  numeroBaccalaureat?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  licenceEtablissement?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  licenceMention?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}$/, {
    message: "L'année d'obtention de la Licence doit être au format AAAA",
  })
  licenceAnneeObtention?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9\-_/.\s]+$/, {
    message: 'Le numéro de bordereau de versement contient des caractères invalides',
  })
  @MaxLength(100)
  numeroBordereau?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  cvPath?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  lettreMotivationPath?: string;

  @IsOptional()
  @IsEnum(AdmissionStatus)
  statut?: AdmissionStatus;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  commentaire?: string;
}
