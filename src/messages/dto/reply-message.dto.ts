import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReplyMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sujet?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  message!: string;
}
