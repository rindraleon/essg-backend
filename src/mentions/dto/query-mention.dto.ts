import { Type } from 'class-transformer';
import {
  IsBooleanString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class QueryMentionDto extends PaginationQueryDto {
  @IsOptional()
  @IsBooleanString()
  @IsIn(['true', 'false'])
  isActive?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  domaine?: string;

  /** Charge aussi les parcours associés dans la liste (besoin de l'UI). */
  @IsOptional()
  @IsIn(['true', 'false'])
  withParcours?: string;
}

export class QueryParcoursDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  mentionId?: number;
}
