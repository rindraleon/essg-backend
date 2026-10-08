import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { TrimTransformer } from './create-mention.dto';

/** Création d'un parcours isolé rattaché à une mention existante. */
export class CreateParcoursDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  mentionId!: number;

  @TrimTransformer()
  @IsString()
  @MinLength(2, { message: 'Le nom du parcours doit contenir au moins 2 caractères.' })
  @MaxLength(150)
  nom!: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

/**
 * Mise à jour d'un parcours. `mentionId` permet de déplacer un parcours vers
 * une autre mention ; ce déplacement est refusé si des formations utilisent
 * déjà ce parcours.
 */
export class UpdateParcoursDto extends PartialType(CreateParcoursDto) {}
