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
import { QueryRessourceHumaineDto } from './dto/query-ressource-humaine.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  CreateRessourceHumaineDto,
  UpdateRessourceHumaineDto,
} from './dto/create-ressource-humaine.dto';
import { RessourcesHumainesService } from './ressources-humaines.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiPaginatedResponse,
  ApiStandardErrors,
  ApiStandardResponse,
} from '../common/swagger/api-response.decorator';

@ApiTags('Ressources humaines')
@Controller('ressources-humaines')
export class RessourcesHumainesController {
  constructor(private readonly service: RessourcesHumainesService) {}

  @Get()
  @ApiOperation({
    summary: "Lister les membres de l'équipe",
    description: 'Liste paginée du personnel présenté sur le site.',
  })
  @ApiPaginatedResponse(undefined, 'Liste paginée signée ITDCMADA')
  @ApiStandardErrors({ auth: false })
  @ApiMessage('Ressources humaines récupérées')
  findAll(@Query() paginationDto: QueryRessourceHumaineDto) {
    return this.service.findAll(paginationDto);
  }

  @Get('search')
  @ApiOperation({
    summary: 'Rechercher un membre',
    description: 'Recherche sur le nom, le prénom et la fonction.',
  })
  @ApiPaginatedResponse(undefined, 'Liste paginée signée ITDCMADA')
  @ApiStandardErrors({ auth: false })
  @ApiMessage('Recherche effectuée')
  search(@Query('q') query: string, @Query() paginationDto: QueryRessourceHumaineDto) {
    return this.service.search(query, paginationDto);
  }

  @Get('slug/:slug')
  @ApiOperation({
    summary: 'Consulter un membre par slug',
    description: 'Utilisé par le site vitrine.',
  })
  @ApiStandardResponse(undefined, { description: 'Opération effectuée avec succès' })
  @ApiStandardErrors({ auth: false, notFound: true })
  @ApiMessage('Ressource humaine récupérée')
  findBySlug(@Param('slug') slug: string) {
    return this.service.findBySlug(slug);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Consulter un membre',
    description: "Détail complet d'un membre de l'équipe.",
  })
  @ApiStandardResponse(undefined, { description: 'Opération effectuée avec succès' })
  @ApiStandardErrors({ auth: false, notFound: true })
  @ApiMessage('Ressource humaine récupérée')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Ajouter un membre',
    description:
      'La photo est téléversée au préalable via `POST /upload/image?folder=staff` (URL `.webp`).',
  })
  @ApiStandardResponse(undefined, { status: 201, description: 'Ressource créée' })
  @ApiStandardErrors({ auth: true, conflict: true })
  @ApiMessage('Ressource humaine créée avec succès')
  create(@Body() dto: CreateRessourceHumaineDto) {
    return this.service.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Mettre à jour un membre',
    description: "Mise à jour d'une fiche existante.",
  })
  @ApiStandardResponse(undefined, { description: 'Opération effectuée avec succès' })
  @ApiStandardErrors({ auth: true, notFound: true, conflict: true })
  @ApiMessage('Ressource humaine mise à jour')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRessourceHumaineDto) {
    return this.service.update(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Supprimer un membre',
    description: 'Suppression définitive de la fiche.',
  })
  @ApiStandardResponse(undefined, { description: 'Opération effectuée avec succès' })
  @ApiStandardErrors({ auth: true, notFound: true })
  @ApiMessage('Ressource humaine supprimée')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
