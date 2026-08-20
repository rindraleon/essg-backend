import { IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { AdmissionStatus } from '../entities/admission.entity';

export class UpdateAdmissionStatusDto {
  @IsEnum(AdmissionStatus)
  statut: AdmissionStatus;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  commentaire?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La date doit être au format AAAA-MM-JJ' })
  reponseDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: "L'heure doit être au format HH:MM" })
  reponseHeure?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reponseLieu?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  reponseInstructions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  reponseMessage?: string;
}
