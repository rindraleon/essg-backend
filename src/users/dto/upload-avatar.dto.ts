import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadAvatarDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  avatar?: string;
}
