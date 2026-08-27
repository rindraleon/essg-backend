import {
  IsDateString,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { IsValidEmail, IsValidPhoneOptional } from '../../common/validators/contact.validators';
import { ADMISSION_LEVELS, BAC_CATEGORIES, BAC_TYPES } from '../admission-rules.constant';
import { AdmissionStatus } from '../entities/admission.entity';

export const ADMISSION_NIVEAUX = ADMISSION_LEVELS;
export type AdmissionNiveau = (typeof ADMISSION_NIVEAUX)[number];

export class CreateAdmissionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nom!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  prenom!: string;

  @IsValidEmail()
  email!: string;

  @IsValidPhoneOptional()
  telephone?: string;

  @IsDateString()
  dateNaissance!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  lieuNaissance!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(15)
  nationalite!: string;

  @IsString()
  @IsIn(['feminin', 'masculin', 'autre'])
  sexe!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  adresse!: string;

  @IsString()
  @IsIn(ADMISSION_LEVELS)
  niveau!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  formation!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  diplomePrecedent!: string;

  @IsString()
  @IsIn(BAC_TYPES)
  bacType!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  bacSerie!: string;

  @IsString()
  @IsIn(BAC_CATEGORIES)
  bacCategorie!: string;

  @IsString()
  @Matches(/^[A-Za-z0-9\-_/.\s]+$/, {
    message: "Le numéro d'inscription au baccalauréat contient des caractères invalides",
  })
  @MaxLength(100)
  numeroBaccalaureat!: string;

  @IsString()
  @Matches(/^\d{4}$/, { message: "L'année d'obtention du baccalauréat doit être au format AAAA" })
  bacAnneeObtention!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  bacCentreExamen!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  mention!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  parcours!: string;

  @IsOptional()
  @IsString()
  @MaxLength(55)
  ancienEtablissement?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  numeroMatricule?: string;

  @IsOptional()
  @IsString()
  @MaxLength(55)
  licenceEtablissement?: string;

  @IsOptional()
  @IsString()
  @MaxLength(55)
  licenceMention?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}$/, { message: "L'année d'obtention de la Licence doit être au format AAAA" })
  licenceAnneeObtention?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9\-_/.\s]+$/, {
    message: 'Le numéro de bordereau de versement contient des caractères invalides',
  })
  @MaxLength(15)
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
  @MaxLength(500)
  commentaire?: string;
}
