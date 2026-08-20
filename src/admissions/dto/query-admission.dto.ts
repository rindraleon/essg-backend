import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { AdmissionStatus } from '../entities/admission.entity';

export class QueryAdmissionDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(AdmissionStatus)
  statut?: AdmissionStatus;

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
}
