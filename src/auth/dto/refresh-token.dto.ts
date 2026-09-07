import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token remis lors de la connexion' })
  @IsString()
  @IsNotEmpty({ message: 'Le refresh token est requis.' })
  refreshToken: string;
}
