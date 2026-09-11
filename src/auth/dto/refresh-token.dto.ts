import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiPropertyOptional({
    description:
      'Refresh token remis lors de la connexion. Optionnel : à défaut, le cookie HttpOnly `refresh_token` (émis par le serveur) est utilisé.',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
