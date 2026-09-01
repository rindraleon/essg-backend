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
import { QueryNewsDto } from './dto/query-news.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateActualiteDto, UpdateActualiteDto } from './dto/create-news.dto';
import { NewsService } from './news.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiPaginatedResponse,
  ApiStandardErrors,
  ApiStandardResponse,
} from '../common/swagger/api-response.decorator';

@ApiTags('Actualités')
@Controller('news')
export class NewsController {
  constructor(private readonly service: NewsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lister les actualités',
    description: 'Liste paginée des actualités publiées.',
  })
  @ApiPaginatedResponse(undefined, 'Liste paginée signée ITDCMADA')
  @ApiStandardErrors({ auth: false })
  @ApiMessage('Actualités récupérées')
  findAll(@Query() paginationDto: QueryNewsDto) {
    return this.service.findAll(paginationDto);
  }

  @Get('search')
  @ApiOperation({
    summary: 'Rechercher une actualité',
    description: 'Recherche sur le titre, le résumé et le contenu.',
  })
  @ApiPaginatedResponse(undefined, 'Liste paginée signée ITDCMADA')
  @ApiStandardErrors({ auth: false })
  @ApiMessage('Recherche effectuée')
  search(@Query('q') query: string, @Query() paginationDto: QueryNewsDto) {
    return this.service.search(query, paginationDto);
  }

  @Get('slug/:slug')
  @ApiOperation({
    summary: 'Consulter une actualité par slug',
    description: 'Utilisé par le site vitrine.',
  })
  @ApiStandardResponse(undefined, { description: 'Opération effectuée avec succès' })
  @ApiStandardErrors({ auth: false, notFound: true })
  @ApiMessage('Actualité récupérée')
  findBySlug(@Param('slug') slug: string) {
    return this.service.findBySlug(slug);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Consulter une actualité',
    description: "Détail complet d'une actualité.",
  })
  @ApiStandardResponse(undefined, { description: 'Opération effectuée avec succès' })
  @ApiStandardErrors({ auth: false, notFound: true })
  @ApiMessage('Actualité récupérée')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Créer une actualité',
    description:
      "L'image de couverture est téléversée au préalable via `POST /upload/image?folder=news` (URL `.webp`).",
  })
  @ApiStandardResponse(undefined, { status: 201, description: 'Ressource créée' })
  @ApiStandardErrors({ auth: true, conflict: true })
  @ApiMessage('Actualité créée avec succès')
  create(@Body() dto: CreateActualiteDto) {
    return this.service.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Mettre à jour une actualité',
    description: "Mise à jour d'une actualité existante.",
  })
  @ApiStandardResponse(undefined, { description: 'Opération effectuée avec succès' })
  @ApiStandardErrors({ auth: true, notFound: true, conflict: true })
  @ApiMessage('Actualité mise à jour')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateActualiteDto) {
    return this.service.update(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Supprimer une actualité',
    description: "Suppression définitive de l'actualité.",
  })
  @ApiStandardResponse(undefined, { description: 'Opération effectuée avec succès' })
  @ApiStandardErrors({ auth: true, notFound: true })
  @ApiMessage('Actualité supprimée')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
