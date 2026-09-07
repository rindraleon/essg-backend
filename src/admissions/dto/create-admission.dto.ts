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
import {
  IsValidBacNumber,
  IsValidDiplomaYear,
  IsValidPersonName,
  IsValidPlaceName,
} from '../../common/validators/person.validators';
import {
  ADMISSION_GENRES,
  ADMISSION_LEVELS,
  ADMISSION_SOURCES,
  BAC_CATEGORIES,
  BAC_TYPES,
} from '../admission-rules.constant';
import { AdmissionStatus } from '../entities/admission.entity';

export const ADMISSION_NIVEAUX = ADMISSION_LEVELS;
export type AdmissionNiveau = (typeof ADMISSION_NIVEAUX)[number];

const ADDRESS_REGEX = /^[\p{L}0-9][\p{L}0-9\s,.'’\-/()]*$/u;

export class CreateAdmissionDto {
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

  @IsDateString()
  dateNaissance!: string;

  @IsValidPlaceName('Veuillez saisir un lieu de naissance valide.')
  @IsNotEmpty({ message: 'Le lieu de naissance est obligatoire.' })
  @MaxLength(150)
  lieuNaissance!: string;

  @IsValidPersonName(
    'La nationalité ne peut contenir que des lettres, espaces, apostrophes ou traits d’union.',
  )
  @IsNotEmpty({ message: 'La nationalité est obligatoire.' })
  @MaxLength(100)
  nationalite!: string;

  @IsString()
  @IsIn(ADMISSION_GENRES, { message: 'Le genre sélectionné est invalide.' })
  genre!: string;

  @IsString()
  @Matches(ADDRESS_REGEX, {
    message: "L'adresse contient des caractères non autorisés.",
  })
  @IsNotEmpty({ message: "L'adresse est obligatoire." })
  @MaxLength(255)
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

  @IsValidBacNumber(
    'Le numéro du baccalauréat doit contenir uniquement des chiffres (4 à 20 chiffres).',
  )
  @IsNotEmpty({ message: "Le numéro d'inscription au baccalauréat est obligatoire." })
  @MaxLength(20)
  numeroBaccalaureat!: string;

  @IsValidDiplomaYear(
    "L'année d'obtention du baccalauréat doit être composée de 4 chiffres, dans la plage autorisée.",
  )
  @IsNotEmpty({ message: "L'année d'obtention du baccalauréat est obligatoire." })
  bacAnneeObtention!: string;

  @IsValidPlaceName('Veuillez saisir un centre d’examen valide.')
  @IsNotEmpty({ message: "Le centre d'examen est obligatoire." })
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
  @IsValidDiplomaYear(
    "L'année d'obtention de la Licence doit être composée de 4 chiffres, dans la plage autorisée.",
  )
  licenceAnneeObtention?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9\-_/.\s]+$/, {
    message: 'Le numéro de bordereau de versement contient des caractères invalides',
  })
  @MaxLength(15)
  numeroBordereau?: string;

  @IsString()
  @IsIn(ADMISSION_SOURCES, {
    message: "La source de reconnaissance de l'ESSG sélectionnée est invalide.",
  })
  @IsNotEmpty({ message: "Merci d'indiquer comment vous avez connu l'ESSG." })
  sourceReconnaissance!: string;

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
