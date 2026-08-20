import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const PRESIGN_FOLDERS = [
  'images',
  'documents',
  'projects',
  'news',
  'formations',
  'partners',
  'avatars',
  'staff',
] as const;

export class PresignUploadDto {
  @IsString()
  @MaxLength(180)
  fileName!: string;

  @IsString()
  mimeType!: string;

  @IsInt()
  @Min(1)
  @Max(20 * 1024 * 1024)
  size!: number;

  @IsOptional()
  @IsIn(PRESIGN_FOLDERS)
  folder?: (typeof PRESIGN_FOLDERS)[number];
}
