import { IsString, IsBoolean, IsOptional, IsArray, MaxLength } from 'class-validator';

export class CreateActualiteDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  slug?: string;

  @IsString()
  @MaxLength(100)
  titre!: string;

  @IsString()
  @MaxLength(20)
  categorie!: string;

  @IsString()
  @MaxLength(10)
  date!: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  resume?: string;

  @IsString()
  @MaxLength(3000)
  contenu!: string;

  @IsString()
  @MaxLength(50)
  auteur!: string;

  @IsBoolean()
  @IsOptional()
  statut?: boolean;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  image?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(255, { each: true })
  galerie?: string[];

  @IsBoolean()
  @IsOptional()
  enVedette?: boolean;
}

export class UpdateActualiteDto extends CreateActualiteDto {}
