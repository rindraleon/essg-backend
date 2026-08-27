import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';

export class QueryActivityLogDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  userId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  module?: string;

  @IsOptional()
  @IsIn(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
  method?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  statusCode?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }): unknown => {
    if (value === true || value === 'true' || value === '1') return true;
    if (value === false || value === 'false' || value === '0') return false;
    return value;
  })
  @IsBoolean()
  success?: boolean;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  search?: string;
}
