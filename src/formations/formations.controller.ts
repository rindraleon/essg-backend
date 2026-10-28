import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiMessage } from '../common/decorators/api-message.decorator';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../users/users.constants';
import { CreateFormationDto, UpdateFormationDto } from './dto/create-formation.dto';
import { FormationsService } from './formations.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiPaginatedResponse,
  ApiStandardErrors,
  ApiStandardResponse,
} from '../common/swagger/api-response.decorator';
import {
  API_BEARER_AUTH_NAME,
  SWAGGER_OPERATION_SUCCESS,
} from '../common/swagger/swagger.constants';

@ApiTags('Formations')
@Controller('formations')
export class FormationsController {
  constructor(private readonly service: FormationsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lister les formations',
    description: "Catalogue paginé des formations proposées par l'ESSG.",
  })
  @ApiPaginatedResponse(undefined, 'Liste paginée signée ITDCMADA')
  @ApiStandardErrors({ auth: false })
  @ApiMessage('Formations récupérées')
  findAll(@Query() paginationDto: PaginationQueryDto) {
    return this.service.findAll(paginationDto);
  }

  @Get('mentions')
  @ApiOperation({
    summary: 'Lister les mentions (compatibilité)',
    deprecated: true,
    description:
      'Endpoint de compatibilité : renvoie les mentions réellement enregistrées (table `mentions`). Préférer `GET /mentions` ou `GET /mentions/options`.',
  })
  @ApiStandardResponse(undefined, { description: SWAGGER_OPERATION_SUCCESS })
  @ApiStandardErrors({ auth: false })
  @ApiMessage('Mentions récupérées')
  findMentions() {
    return this.service.findMentionLabels();
  }

  @Get('search')
  @ApiOperation({
    summary: 'Rechercher une formation',
    description: "Recherche sur l'intitulé et la description.",
  })
  @ApiPaginatedResponse(undefined, 'Liste paginée signée ITDCMADA')
  @ApiStandardErrors({ auth: false })
  @ApiMessage('Recherche effectuée')
  search(@Query('q') query: string, @Query() paginationDto: PaginationQueryDto) {
    return this.service.search(query, paginationDto);
  }

  @Get('slug/:slug')
  @ApiOperation({
    summary: 'Consulter une formation par slug',
    description: 'Utilisé par le site vitrine.',
  })
  @ApiStandardResponse(undefined, { description: SWAGGER_OPERATION_SUCCESS })
  @ApiStandardErrors({ auth: false, notFound: true })
  @ApiMessage('Formation récupérée')
  findBySlug(@Param('slug') slug: string) {
    return this.service.findBySlug(slug);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Consulter une formation',
    description: "Détail complet d'une formation.",
  })
  @ApiStandardResponse(undefined, { description: SWAGGER_OPERATION_SUCCESS })
  @ApiStandardErrors({ auth: false, notFound: true })
  @ApiMessage('Formation récupérée')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.CONTENT_CREATE)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth(API_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Créer une formation',
    description:
      'Le visuel est téléversé au préalable via `POST /upload/image?folder=formations` (URL `.webp`).',
  })
  @ApiStandardResponse(undefined, { status: 201, description: 'Ressource créée' })
  @ApiStandardErrors({ auth: true, conflict: true })
  @ApiMessage('Formation créée avec succès')
  create(@Body() dto: CreateFormationDto) {
    return this.service.create(dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.CONTENT_UPDATE)
  @Put(':id')
  @ApiBearerAuth(API_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Mettre à jour une formation',
    description: "Mise à jour d'une formation existante.",
  })
  @ApiStandardResponse(undefined, { description: SWAGGER_OPERATION_SUCCESS })
  @ApiStandardErrors({ auth: true, notFound: true, conflict: true })
  @ApiMessage('Formation mise à jour')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateFormationDto) {
    return this.service.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.CONTENT_DELETE)
  @Delete(':id')
  @ApiBearerAuth(API_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Supprimer une formation',
    description: 'Suppression définitive de la formation.',
  })
  @ApiStandardResponse(undefined, { description: SWAGGER_OPERATION_SUCCESS })
  @ApiStandardErrors({ auth: true, notFound: true })
  @ApiMessage('Formation supprimée')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
