import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { MentionParcoursInputDto, TrimTransformer } from './create-mention.dto';

/**
 * Mise à jour d'une mention.
 *
 * Sémantique du champ `parcours` : liste complète et définitive des parcours
 * de la mention après enregistrement (upsert). Un parcours existant absent de
 * la liste est supprimé — la suppression est refusée si des formations
 * l'utilisent déjà. Une liste vide est autorisée (tous les parcours retirés).
 */
export class UpdateMentionDto {
  @TrimTransformer()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  @IsOptional()
  nom?: string;

  @TrimTransformer()
  @IsString()
  @MaxLength(150)
  @IsOptional()
  domaine?: string;

  @TrimTransformer()
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MentionParcoursInputDto)
  @IsOptional()
  parcours?: MentionParcoursInputDto[];
}
