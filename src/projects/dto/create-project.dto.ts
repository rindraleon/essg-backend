import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsString, IsArray, IsOptional, IsIn, IsInt, MaxLength } from 'class-validator';

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

  /** Identifiants des partenaires sélectionnés dans le Select du back-office. */
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
