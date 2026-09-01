import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { API_SIGNATURE } from '../constants/api.constants';

export class PaginationMetaDto {
  @ApiProperty({ example: 42, description: "Nombre total d'éléments disponibles" })
  total!: number;

  @ApiProperty({ example: 1, description: 'Page courante (commence à 1)' })
  page!: number;

  @ApiProperty({ example: 10, description: "Nombre d'éléments par page" })
  limit!: number;

  @ApiProperty({ example: 5, description: 'Nombre total de pages' })
  totalPages!: number;
}

export class ApiSuccessResponseDto {
  @ApiProperty({ example: 200, description: 'Code HTTP de la réponse' })
  statusCode!: number;

  @ApiProperty({
    example: 'Données récupérées avec succès',
    description: 'Message fonctionnel lisible par un humain',
  })
  message!: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    description: 'Charge utile de la réponse (objet, tableau ou null)',
  })
  data?: unknown;

  @ApiPropertyOptional({ type: PaginationMetaDto, description: 'Présent sur les listes paginées' })
  meta?: PaginationMetaDto;

  @ApiProperty({
    example: API_SIGNATURE,
    enum: [API_SIGNATURE],
    description: "Signature de l'éditeur de l'API — toujours « ITDCMADA »",
  })
  signature!: typeof API_SIGNATURE;

  @ApiProperty({
    example: '2026-08-21T09:30:00.000Z',
    description: 'Horodatage ISO 8601 de génération de la réponse',
  })
  timestamp!: string;

  @ApiPropertyOptional({
    example: '/users?page=1&limit=10',
    description: "Chemin de la requête à l'origine de la réponse",
  })
  path?: string;
}

export class ApiErrorResponseDto {
  @ApiProperty({ example: 400, description: 'Code HTTP de l’erreur' })
  statusCode!: number;

  @ApiProperty({
    example: 'Les données envoyées sont invalides.',
    description: 'Message d’erreur lisible, déjà traduit en français',
  })
  message!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: null,
    nullable: true,
    description: 'Toujours null en cas d’erreur',
  })
  data?: unknown;

  @ApiProperty({
    example: API_SIGNATURE,
    enum: [API_SIGNATURE],
    description: "Signature de l'éditeur de l'API — toujours « ITDCMADA »",
  })
  signature!: typeof API_SIGNATURE;

  @ApiProperty({ example: '2026-08-21T09:30:00.000Z' })
  timestamp!: string;

  @ApiPropertyOptional({ example: '/users/999' })
  path?: string;
}
