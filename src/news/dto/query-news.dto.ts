import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class QueryNewsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  categorie?: string;

  @IsOptional()
  @IsIn(['publie', 'brouillon', 'archive'])
  statut?: 'publie' | 'brouillon' | 'archive';
}
