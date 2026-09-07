import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { AdmissionStatus } from '../entities/admission.entity';

export class QueryAdmissionDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(AdmissionStatus)
  statut?: AdmissionStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  annee?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  niveau?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  formation?: string;

  @IsOptional()
  @IsDateString()
  dateDebut?: string;

  @IsOptional()
  @IsDateString()
  dateFin?: string;
}
