import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class QueryRessourceHumaineDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  poste?: string;
}
