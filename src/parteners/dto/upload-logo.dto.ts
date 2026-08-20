import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadLogoDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  logo?: string;
}
