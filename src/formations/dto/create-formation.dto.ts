import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  IsString,
  IsArray,
  IsBoolean,
  IsOptional,
  IsIn,
  IsInt,
  MaxLength,
  Min,
} from 'class-validator';
import { IsValidEmailOptional } from '../../common/email/email.validators';

export class CreateFormationDto {
  /**
   * Identifiant du parcours rattaché — source de vérité de la hiérarchie
   * Domaine → Mention → Parcours → Formation. La mention de la formation en
   * est déduite automatiquement.
   */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  parcoursId!: number;

  /**
   * Miroir déprécié, calculé depuis le parcours. Accepté uniquement pour
   * valider la cohérence avec le parcours sélectionné ; jamais saisi seul.
   */
  @IsString()
  @MaxLength(150)
  @IsOptional()
  mention?: string;

  /** Miroir déprécié, calculé depuis la mention du parcours. */
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  @IsOptional()
  domaine?: string[];

  /**
   * Intitulé de la formation. Omissible : elle vaut alors le nom du parcours
   * rattaché (Formation et Parcours portent la même information métier, le
   * frontend n'envoie donc jamais deux propriétés redondantes).
   */
  @IsString()
  @MaxLength(150)
  @IsOptional()
  titre?: string;

  @IsIn(['Licence', 'Master', 'Doctorat'])
  niveau!: 'Licence' | 'Master' | 'Doctorat';

  @IsString()
  @MaxLength(60)
  duree!: string;

  @IsString()
  @MaxLength(1000)
  description!: string;

  @IsArray()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  objectifs!: string[];

  @IsArray()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  debouches!: string[];

  @IsString()
  @IsOptional()
  @MaxLength(500)
  conditionsAcces?: string;

  @IsArray()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  @IsOptional()
  programme?: string[];

  @IsArray()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  @IsOptional()
  conditions?: string[];

  @IsArray()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  @IsOptional()
  competences?: string[];

  @IsArray()
  @IsOptional()
  modules?: unknown[];

  @IsString()
  @IsOptional()
  @MaxLength(100)
  responsable?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  responsableId?: number;

  @IsValidEmailOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  image?: string;

  @IsBoolean()
  @IsOptional()
  enVedette?: boolean;

  @Type(() => Number)
  @IsInt()
  credits!: number;
}

export class UpdateFormationDto extends PartialType(CreateFormationDto) {}
