import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ApiMessage } from '../common/decorators/api-message.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  API_BEARER_AUTH_NAME,
  SWAGGER_OPERATION_SUCCESS,
} from '../common/swagger/swagger.constants';
import {
  ApiPaginatedResponse,
  ApiStandardErrors,
  ApiStandardResponse,
} from '../common/swagger/api-response.decorator';
import { CreateMentionDto } from './dto/create-mention.dto';
import { QueryMentionDto } from './dto/query-mention.dto';
import { UpdateMentionDto } from './dto/update-mention.dto';
import { MentionsService } from './mentions.service';

@ApiTags('Mentions')
@Controller('mentions')
export class MentionsController {
  constructor(private readonly service: MentionsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lister les mentions',
    description:
      'Catalogue paginé des mentions (avec parcoursCount). `withParcours=true` charge aussi la liste des parcours de chaque mention.',
  })
  @ApiPaginatedResponse(undefined, 'Liste paginée des mentions')
  @ApiStandardErrors({ auth: false })
  @ApiMessage('Mentions récupérées')
  findAll(@Query() query: QueryMentionDto) {
    return this.service.findAll(query);
  }

  @Get('options')
  @ApiOperation({
    summary: 'Options des mentions actives',
    description: 'Liste légère (id, nom, slug, domaine) pour les listes déroulantes.',
  })
  @ApiStandardResponse(undefined, { description: SWAGGER_OPERATION_SUCCESS })
  @ApiStandardErrors({ auth: false })
  @ApiMessage('Options récupérées')
  findOptions() {
    return this.service.findActiveOptions();
  }

  @Get('domaines')
  @ApiOperation({
    summary: 'Domaines distincts des mentions',
    description: 'Alimente le dropdown « Domaine » des formulaires dépendants.',
  })
  @ApiStandardResponse('string', {
    isArray: true,
    description: 'Domaines distincts',
  })
  @ApiStandardErrors({ auth: false })
  @ApiMessage('Domaines récupérés')
  findDomaines() {
    return this.service.findDistinctDomaines();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Consulter une mention',
    description:
      'Détail complet : parcours, nombre de parcours et — avec `withFormations=true` — formations rattachées.',
  })
  @ApiQuery({ name: 'withFormations', required: false, type: Boolean })
  @ApiStandardResponse(undefined, { description: SWAGGER_OPERATION_SUCCESS })
  @ApiStandardErrors({ auth: false, notFound: true })
  @ApiMessage('Mention récupérée')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Query('withFormations', new ParseBoolPipe({ optional: true })) withFormations?: boolean,
  ) {
    return this.service.findOne(id, { withFormations });
  }

  @Get(':id/parcours')
  @ApiOperation({
    summary: 'Parcours d’une mention',
    description: 'Parcours filtrés par mention, avec nombre de formations associées.',
  })
  @ApiStandardResponse(undefined, { isArray: true, description: SWAGGER_OPERATION_SUCCESS })
  @ApiStandardErrors({ auth: false, notFound: true })
  @ApiMessage('Parcours récupérés')
  findParcours(@Param('id', ParseIntPipe) id: number) {
    return this.service.findParcoursByMention(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth(API_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Créer une mention avec ses parcours',
    description:
      'Enregistrement atomique : la mention et la liste de parcours sont créées dans une seule transaction. Si un parcours échoue, tout est annulé.',
  })
  @ApiStandardResponse(undefined, { status: 201, description: 'Ressource créée' })
  @ApiStandardErrors({ auth: true, conflict: true })
  @ApiMessage('Mention créée avec succès')
  create(@Body() dto: CreateMentionDto) {
    return this.service.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  @ApiOperation({
    summary: 'Mettre à jour une mention',
    description:
      'Le tableau `parcours` est la liste définitive des parcours après enregistrement (création/renommage/suppression différée). La suppression d’un parcours utilisé par des formations est refusée avec un message explicite.',
  })
  @ApiBearerAuth(API_BEARER_AUTH_NAME)
  @ApiStandardResponse(undefined, { description: SWAGGER_OPERATION_SUCCESS })
  @ApiStandardErrors({ auth: true, notFound: true, conflict: true })
  @ApiMessage('Mention mise à jour avec succès')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMentionDto) {
    return this.service.update(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiBearerAuth(API_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Supprimer une mention',
    description:
      'Blocage si la mention possède des formations rattachées. `cascade=true` autorise la suppression des parcours associés (uniquement s’ils n’ont aucune formation).',
  })
  @ApiQuery({ name: 'cascade', required: false, type: Boolean })
  @ApiStandardResponse(undefined, { description: SWAGGER_OPERATION_SUCCESS })
  @ApiStandardErrors({ auth: true, notFound: true })
  @ApiMessage('Mention supprimée')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Query('cascade', new ParseBoolPipe({ optional: true })) cascade?: boolean,
  ) {
    return this.service.remove(id, cascade ?? false);
  }
}
