import { applyDecorators, HttpStatus, Type } from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { API_SIGNATURE } from '../constants/api.constants';
import { ApiErrorResponseDto, ApiSuccessResponseDto, PaginationMetaDto } from './api-response.dto';

interface StandardResponseOptions {
  status?: HttpStatus | number;
  description?: string;
  isArray?: boolean;
  paginated?: boolean;
}

function dataSchema(model?: Type<unknown> | 'string' | 'number' | 'boolean', isArray = false) {
  if (!model) {
    return { type: 'object', nullable: true, additionalProperties: true };
  }
  const base = typeof model === 'string' ? { type: model } : { $ref: getSchemaPath(model) };
  return isArray ? { type: 'array', items: base } : base;
}

export const ApiStandardResponse = (
  model?: Type<unknown> | 'string' | 'number' | 'boolean',
  options: StandardResponseOptions = {},
): MethodDecorator & ClassDecorator => {
  const { status = HttpStatus.OK, description, isArray = false, paginated = false } = options;

  const extraModels: Type<unknown>[] = [ApiSuccessResponseDto, PaginationMetaDto];
  if (model && typeof model !== 'string') extraModels.push(model);

  return applyDecorators(
    ApiExtraModels(...extraModels),
    ApiResponse({
      status,
      description: description ?? 'Requête traitée avec succès — réponse signée ITDCMADA',
      schema: {
        allOf: [
          {
            type: 'object',
            required: ['statusCode', 'message', 'data', 'signature', 'timestamp'],
            properties: {
              statusCode: { type: 'number', example: status },
              message: { type: 'string', example: 'Opération effectuée avec succès' },
              data: dataSchema(model, isArray),
              ...(paginated ? { meta: { $ref: getSchemaPath(PaginationMetaDto) } } : {}),
              signature: {
                type: 'string',
                enum: [API_SIGNATURE],
                example: API_SIGNATURE,
                description: "Signature de l'éditeur — toujours « ITDCMADA »",
              },
              timestamp: { type: 'string', format: 'date-time' },
              path: { type: 'string', example: '/users' },
            },
          },
        ],
      },
    }),
  );
};

export const ApiPaginatedResponse = (
  model?: Type<unknown>,
  description?: string,
): MethodDecorator & ClassDecorator =>
  ApiStandardResponse(model, { description, isArray: true, paginated: true });

interface ErrorDocOptions {
  auth?: boolean;
  notFound?: boolean;
  validation?: boolean;
  conflict?: boolean;
  payload?: boolean;
}

export const ApiStandardErrors = (
  options: ErrorDocOptions = {},
): MethodDecorator & ClassDecorator => {
  const {
    auth = true,
    notFound = false,
    validation = true,
    conflict = false,
    payload = false,
  } = options;

  const decorators: Array<MethodDecorator & ClassDecorator> = [ApiExtraModels(ApiErrorResponseDto)];

  if (validation) {
    decorators.push(
      ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Données invalides ou fichier refusé',
        type: ApiErrorResponseDto,
      }),
    );
  }
  if (auth) {
    decorators.push(
      ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Jeton JWT absent, expiré ou invalide',
        type: ApiErrorResponseDto,
      }),
      ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description: 'Rôle insuffisant pour cette action',
        type: ApiErrorResponseDto,
      }),
    );
  }
  if (notFound) {
    decorators.push(
      ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Ressource introuvable',
        type: ApiErrorResponseDto,
      }),
    );
  }
  if (conflict) {
    decorators.push(
      ApiResponse({
        status: HttpStatus.CONFLICT,
        description: 'Conflit : la valeur existe déjà (email, slug…)',
        type: ApiErrorResponseDto,
      }),
    );
  }
  if (payload) {
    decorators.push(
      ApiResponse({
        status: HttpStatus.SERVICE_UNAVAILABLE,
        description: 'Stockage objet (MinIO) indisponible — aucune URL enregistrée',
        type: ApiErrorResponseDto,
      }),
    );
  }

  decorators.push(
    ApiResponse({
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      description: 'Erreur interne du serveur',
      type: ApiErrorResponseDto,
    }),
  );

  return applyDecorators(...decorators);
};

export const ApiImageUpload = (
  fieldName: string,
  extraProperties: Record<
    string,
    { type: string; format?: string; example?: unknown; description?: string }
  > = {},
  requiredFile = true,
): MethodDecorator & ClassDecorator =>
  applyDecorators(
    ApiConsumes('multipart/form-data'),
    ApiBody({
      required: true,
      schema: {
        type: 'object',
        required: requiredFile ? [fieldName] : [],
        properties: {
          [fieldName]: {
            type: 'string',
            format: 'binary',
            description:
              'Image JPG, JPEG, PNG, GIF ou WebP — 5 Mo maximum. Conversion WebP automatique (Sharp).',
          },
          ...extraProperties,
        },
      },
    }),
  );
