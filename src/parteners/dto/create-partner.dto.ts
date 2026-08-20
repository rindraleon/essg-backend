import { PartialType } from '@nestjs/mapped-types';
import { IsString, IsOptional, IsIn, IsDateString, MaxLength } from 'class-validator';

export class CreatePartenaireDto {
  @IsString()
  @MaxLength(100)
  nom: string = '';

  @IsIn(['Entreprise', 'Institution', 'Organisation', 'Autre'])
  type: 'Entreprise' | 'Institution' | 'Organisation' | 'Autre' = 'Entreprise';

  @IsString()
  @IsOptional()
  @MaxLength(100)
  secteur?: string;

  @IsString()
  @MaxLength(1000)
  description: string = '';

  @IsString()
  @IsOptional()
  @MaxLength(50)
  siteWeb?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  logo?: string;

  @IsString()
  @IsOptional()
  @MaxLength(15)
  contact?: string;

  @IsDateString()
  dateDebut: string = new Date().toISOString().split('T')[0];
}

export class UpdatePartenaireDto extends PartialType(CreatePartenaireDto) {}
