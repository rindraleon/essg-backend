import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  IsString,
  IsArray,
  IsOptional,
  IsIn,
  IsInt,
  IsUrl,
  MaxLength,
  IsNotEmpty,
  ValidateNested,
} from 'class-validator';

export class ProjectSourceDto {
  @IsString()
  @IsNotEmpty({ message: 'Le titre de la source est obligatoire' })
  @MaxLength(150, { message: 'Le titre de la source ne doit pas dépasser 150 caractères' })
  title!: string;

  @IsString()
  @IsNotEmpty({ message: "L'URL de la source est obligatoire" })
  @IsUrl(
    { require_protocol: false, require_tld: false },
    { message: "L'URL de la source est invalide" },
  )
  @MaxLength(500, { message: "L'URL de la source ne doit pas dépasser 500 caractères" })
  url!: string;
}

export class CreateProjetDto {
  @IsString()
  @MaxLength(150)
  titre!: string;

  @IsIn(['International', 'Service public', 'Recherche', 'Partenariat'])
  type!: 'International' | 'Service public' | 'Recherche' | 'Partenariat';

  @IsOptional()
  @IsIn(['En cours', 'Terminé'])
  statut?: 'En cours' | 'Terminé';

  @IsString()
  @MaxLength(20)
  date!: string;

  @IsString()
  @MaxLength(10000)
  description!: string;

  @IsArray()
  @IsOptional()
  @Type(() => Number)
  @IsInt({ each: true })
  partenaireIds?: number[];

  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  @IsOptional()
  partenaires?: string[];

  @IsString()
  @IsOptional()
  @MaxLength(255)
  image?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(255, { each: true })
  galerie?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectSourceDto)
  sources?: ProjectSourceDto[];

  @IsOptional()
  latitude?: number;

  @IsOptional()
  longitude?: number;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  ville?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  pays?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  adresse?: string;
}

export class UpdateProjetDto extends PartialType(CreateProjetDto) {}
