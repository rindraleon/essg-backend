import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsArray,
  ValidateNested,
  ArrayMaxSize,
  MinLength,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  IsValidEmailOptional,
  IsValidPhoneOptional,
} from '../../common/validators/contact.validators';

export class ExperienceProfessionnelleDto {
  @IsString()
  @MinLength(5, { message: 'Le poste doit contenir au moins 5 caractères' })
  @MaxLength(150, { message: 'Le poste ne peut pas dépasser 150 caractères' })
  poste!: string;

  @IsOptional()
  @IsString()
  @MaxLength(150, { message: "L'organisation ne peut pas dépasser 150 caractères" })
  organisation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60, { message: 'La période ne peut pas dépasser 60 caractères' })
  periode?: string;
}

const LISTE_MAX = 40;
const ITEM_MAX = 100;

export class CreateRessourceHumaineDto {
  @IsString()
  @MinLength(5, { message: 'Le nom doit contenir au moins 5 caractères' })
  @MaxLength(100, { message: 'Le nom ne peut pas dépasser 100 caractères' })
  nom!: string;

  @IsString()
  @MinLength(5, { message: 'Le prénom doit contenir au moins 5 caractères' })
  @MaxLength(100, { message: 'Le prénom ne peut pas dépasser 100 caractères' })
  prenom!: string;

  @IsString()
  @MinLength(5, { message: 'Le poste doit contenir au moins 5 caractères' })
  @MaxLength(150, { message: 'Le poste ne peut pas dépasser 150 caractères' })
  poste!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'La description ne peut pas dépasser 1000 caractères' })
  description?: string;

  @IsValidEmailOptional()
  email?: string;

  @IsValidPhoneOptional()
  telephone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300, { message: "L'adresse ne peut pas dépasser 300 caractères" })
  adresse?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(LISTE_MAX)
  @ValidateNested({ each: true })
  @Type(() => ExperienceProfessionnelleDto)
  experiences?: ExperienceProfessionnelleDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(LISTE_MAX)
  @IsString({ each: true })
  @MaxLength(ITEM_MAX, { each: true })
  formations?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(LISTE_MAX)
  @IsString({ each: true })
  @MaxLength(ITEM_MAX, { each: true })
  diplomes?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(LISTE_MAX)
  @IsString({ each: true })
  @MaxLength(ITEM_MAX, { each: true })
  competences?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(LISTE_MAX)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  langues?: string[];

  @IsOptional()
  @IsString()
  photo?: string;

  @IsOptional()
  @IsBoolean()
  actif?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "L'ordre doit être un nombre entier" })
  @Min(0, { message: "L'ordre ne peut pas être négatif" })
  @Max(9999, { message: "L'ordre ne peut pas dépasser 9999" })
  ordre?: number;
}

export class UpdateRessourceHumaineDto {
  @IsOptional()
  @IsString()
  @MinLength(5, { message: 'Le nom doit contenir au moins 5 caractères' })
  @MaxLength(100, { message: 'Le nom ne peut pas dépasser 100 caractères' })
  nom?: string;

  @IsOptional()
  @IsString()
  @MinLength(5, { message: 'Le prénom doit contenir au moins 5 caractères' })
  @MaxLength(100, { message: 'Le prénom ne peut pas dépasser 100 caractères' })
  prenom?: string;

  @IsOptional()
  @IsString()
  @MinLength(5, { message: 'Le poste doit contenir au moins 5 caractères' })
  @MaxLength(150, { message: 'Le poste ne peut pas dépasser 150 caractères' })
  poste?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'La description ne peut pas dépasser 1000 caractères' })
  description?: string;

  @IsValidEmailOptional()
  email?: string;

  @IsValidPhoneOptional()
  telephone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30, { message: "L'adresse ne peut pas dépasser 30 caractères" })
  adresse?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(LISTE_MAX)
  @ValidateNested({ each: true })
  @Type(() => ExperienceProfessionnelleDto)
  experiences?: ExperienceProfessionnelleDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(LISTE_MAX)
  @IsString({ each: true })
  @MaxLength(ITEM_MAX, { each: true })
  formations?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(LISTE_MAX)
  @IsString({ each: true })
  @MaxLength(ITEM_MAX, { each: true })
  diplomes?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(LISTE_MAX)
  @IsString({ each: true })
  @MaxLength(ITEM_MAX, { each: true })
  competences?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(LISTE_MAX)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  langues?: string[];

  @IsOptional()
  @IsString()
  photo?: string;

  @IsOptional()
  @IsBoolean()
  actif?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "L'ordre doit être un nombre entier" })
  @Min(0, { message: "L'ordre ne peut pas être négatif" })
  @Max(9999, { message: "L'ordre ne peut pas dépasser 9999" })
  ordre?: number;
}
