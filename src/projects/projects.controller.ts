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
import { QueryProjectDto } from './dto/query-project.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../users/users.constants';
import { CreateProjetDto, UpdateProjetDto } from './dto/create-project.dto';
import { ProjectsService } from './projects.service';
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

@ApiTags('Projets')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lister les projets',
    description:
      'Liste paginée des projets. Les images (`image`, galerie) sont des URL `.webp` servies par `/media/...`.',
  })
  @ApiPaginatedResponse(undefined, 'Liste paginée signée ITDCMADA')
  @ApiStandardErrors({ auth: false })
  @ApiMessage('Projets récupérés')
  findAll(@Query() paginationDto: QueryProjectDto) {
    return this.service.findAll(paginationDto);
  }

  @Get('search')
  @ApiOperation({
    summary: 'Rechercher un projet',
    description: 'Recherche plein texte sur le titre et la description.',
  })
  @ApiPaginatedResponse(undefined, 'Liste paginée signée ITDCMADA')
  @ApiStandardErrors({ auth: false })
  @ApiMessage('Recherche effectuée')
  search(@Query('q') query: string, @Query() paginationDto: QueryProjectDto) {
    return this.service.search(query, paginationDto);
  }

  @Get('slug/:slug')
  @ApiOperation({
    summary: 'Consulter un projet par slug',
    description: 'Utilisé par le site vitrine pour les URL lisibles.',
  })
  @ApiStandardResponse(undefined, { description: SWAGGER_OPERATION_SUCCESS })
  @ApiStandardErrors({ auth: false, notFound: true })
  @ApiMessage('Projet récupéré')
  findBySlug(@Param('slug') slug: string) {
    return this.service.findBySlug(slug);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Consulter un projet',
    description: "Détail complet d'un projet.",
  })
  @ApiStandardResponse(undefined, { description: SWAGGER_OPERATION_SUCCESS })
  @ApiStandardErrors({ auth: false, notFound: true })
  @ApiMessage('Projet récupéré')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.CONTENT_CREATE)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth(API_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Créer un projet',
    description:
      "Les images doivent d'abord être téléversées via `POST /upload/image?folder=projects` (conversion WebP) ; on enregistre ensuite l'URL renvoyée.",
  })
  @ApiStandardResponse(undefined, { status: 201, description: 'Ressource créée' })
  @ApiStandardErrors({ auth: true, conflict: true })
  @ApiMessage('Projet créé avec succès')
  create(@Body() dto: CreateProjetDto) {
    return this.service.create(dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.CONTENT_UPDATE)
  @Put(':id')
  @ApiBearerAuth(API_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Mettre à jour un projet',
    description: "Mise à jour partielle ou complète d'un projet existant.",
  })
  @ApiStandardResponse(undefined, { description: SWAGGER_OPERATION_SUCCESS })
  @ApiStandardErrors({ auth: true, notFound: true, conflict: true })
  @ApiMessage('Projet mis à jour')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProjetDto) {
    return this.service.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.CONTENT_DELETE)
  @Delete(':id')
  @ApiBearerAuth(API_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Supprimer un projet',
    description: 'Suppression définitive du projet.',
  })
  @ApiStandardResponse(undefined, { description: SWAGGER_OPERATION_SUCCESS })
  @ApiStandardErrors({ auth: true, notFound: true })
  @ApiMessage('Projet supprimé')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
