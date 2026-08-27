import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class QueryPartnerDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  type?: string;
}
