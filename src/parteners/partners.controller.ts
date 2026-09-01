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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ApiMessage } from '../common/decorators/api-message.decorator';
import { QueryPartnerDto } from './dto/query-partner.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ImageUploadService } from '../common/images/image-upload.service';
import { imageUploadOptions } from '../common/storage/multer.config';
import { STORAGE_PREFIXES } from '../common/storage/storage.constants';
import { StorageService } from '../common/storage/storage.service';
import {
  ApiImageUpload,
  ApiPaginatedResponse,
  ApiStandardErrors,
  ApiStandardResponse,
} from '../common/swagger/api-response.decorator';
import { CreatePartenaireDto, UpdatePartenaireDto } from './dto/create-partner.dto';
import { PartnersService } from './partners.service';

@ApiTags('Partenaires')
@Controller('partners')
export class PartnersController {
  constructor(
    private readonly service: PartnersService,
    private readonly storageService: StorageService,
    private readonly imageUploadService: ImageUploadService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Lister les partenaires',
    description: 'Endpoint public utilisé par le site vitrine et le Back-Office.',
  })
  @ApiPaginatedResponse(undefined, 'Liste paginée des partenaires')
  @ApiStandardErrors({ auth: false })
  @ApiMessage('Partenaires récupérés')
  findAll(@Query() paginationDto: QueryPartnerDto) {
    return this.service.findAll(paginationDto);
  }

  @Get('search')
  @ApiOperation({
    summary: 'Rechercher un partenaire',
    description: 'Recherche par nom ou description.',
  })
  @ApiQuery({ name: 'q', required: false, example: 'université' })
  @ApiPaginatedResponse(undefined, 'Résultats paginés')
  @ApiStandardErrors({ auth: false })
  @ApiMessage('Recherche effectuée')
  search(@Query('q') query: string, @Query() paginationDto: QueryPartnerDto) {
    return this.service.search(query, paginationDto);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Consulter un partenaire par slug' })
  @ApiParam({ name: 'slug', example: 'universite-antananarivo' })
  @ApiStandardResponse(undefined, { description: 'Partenaire trouvé' })
  @ApiStandardErrors({ auth: false, notFound: true })
  @ApiMessage('Partenaire récupéré')
  findBySlug(@Param('slug') slug: string) {
    return this.service.findBySlug(slug);
  }

  @Get('name/:nom')
  @ApiOperation({ summary: 'Consulter un partenaire par nom exact' })
  @ApiParam({ name: 'nom', example: 'Université d’Antananarivo' })
  @ApiStandardResponse(undefined, { description: 'Partenaire trouvé' })
  @ApiStandardErrors({ auth: false, notFound: true })
  @ApiMessage('Partenaire récupéré')
  findByName(@Param('nom') nom: string) {
    return this.service.findByName(nom);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulter un partenaire par identifiant' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiStandardResponse(undefined, { description: 'Partenaire trouvé' })
  @ApiStandardErrors({ auth: false, notFound: true })
  @ApiMessage('Partenaire récupéré')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Créer un partenaire',
    description:
      'Accepte du JSON ou du `multipart/form-data` avec un champ `logo`. Le logo est converti en WebP (Sharp) avant stockage : le champ `logo` enregistré pointe vers `/media/partners/<uuid>.webp`.',
  })
  @ApiImageUpload('logo', {}, false)
  @ApiStandardResponse(undefined, { status: HttpStatus.CREATED, description: 'Partenaire créé' })
  @ApiStandardErrors({ conflict: true, payload: true })
  @ApiMessage('Partenaire créé avec succès')
  @UseInterceptors(FileInterceptor('logo', imageUploadOptions))
  async create(@Body() dto: CreatePartenaireDto, @UploadedFile() file?: Express.Multer.File) {
    if (file) {
      const stored = await this.imageUploadService.upload(file, {
        prefix: STORAGE_PREFIXES.partners,
        preset: 'logo',
      });
      dto.logo = stored.url;
    }
    return this.service.create(dto);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Put(':id')
  @ApiOperation({
    summary: 'Mettre à jour un partenaire',
    description:
      'Le nouveau logo est converti en WebP puis stocké ; l’ancien fichier n’est supprimé qu’après succès complet.',
  })
  @ApiParam({ name: 'id', example: 1 })
  @ApiImageUpload('logo', {}, false)
  @ApiStandardResponse(undefined, { description: 'Partenaire mis à jour' })
  @ApiStandardErrors({ notFound: true, conflict: true, payload: true })
  @ApiMessage('Partenaire mis à jour')
  @UseInterceptors(FileInterceptor('logo', imageUploadOptions))
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePartenaireDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file) {
      const current = await this.service.findOne(id);
      const stored = await this.imageUploadService.upload(file, {
        prefix: STORAGE_PREFIXES.partners,
        preset: 'logo',
        replaceUrl: current.logo,
      });
      dto.logo = stored.url;
    }
    return this.service.update(id, dto);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiOperation({
    summary: 'Supprimer un partenaire',
    description: 'Supprime le partenaire puis son logo dans le stockage objet.',
  })
  @ApiParam({ name: 'id', example: 1 })
  @ApiStandardResponse(undefined, { description: 'Partenaire supprimé' })
  @ApiStandardErrors({ notFound: true })
  @ApiMessage('Partenaire supprimé')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const current = await this.service.findOne(id);
    await this.service.remove(id);
    await this.storageService.deleteStoredRef(current.logo);
  }
}
