import { Type } from 'class-transformer';
import { Transform } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

/** Élagne et normalise les espaces d'une valeur texte. */
export const TrimTransformer = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));

/** Élément « parcours » saisi dynamiquement dans le formulaire de mention. */
export class MentionParcoursInputDto {
  /** Identifiant d'un parcours existant (mode édition uniquement). */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  id?: number;

  @TrimTransformer()
  @IsString()
  @MinLength(2, { message: 'Le nom du parcours doit contenir au moins 2 caractères.' })
  @MaxLength(150)
  nom!: string;
}

export class CreateMentionDto {
  @TrimTransformer()
  @IsString()
  @MinLength(2, { message: 'Le nom de la mention doit contenir au moins 2 caractères.' })
  @MaxLength(150)
  nom!: string;

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

  /** Au moins un parcours est obligatoire à la création. */
  @IsArray()
  @ArrayNotEmpty({ message: 'Une mention doit contenir au moins un parcours.' })
  @ValidateNested({ each: true })
  @Type(() => MentionParcoursInputDto)
  parcours!: MentionParcoursInputDto[];
}
