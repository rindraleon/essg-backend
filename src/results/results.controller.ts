import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { ApiMessage } from '../common/decorators/api-message.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { AllowAllGuard } from '../common/guards/allow-all.guard';
import { Public } from '../common/decorators/public.decorator';
import { PERMISSIONS } from '../users/users.constants';
import { createMimeFilter } from '../common/storage/multer.config';
import { RESULTAT_ACCEPTED_MIMES, ResultsService } from './results.service';
import {
  CreateResultatPublicationDto,
  QueryResultatPublicationDto,
} from './dto/create-resultat-publication.dto';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
  ApiPaginatedResponse,
  ApiStandardErrors,
  ApiStandardResponse,
} from '../common/swagger/api-response.decorator';
import {
  API_BEARER_AUTH_NAME,
  SWAGGER_OPERATION_SUCCESS,
} from '../common/swagger/swagger.constants';
import {
  ResultatPublicationStatus,
  ResultatConsultationMode,
} from './entities/resultat-publication.entity';
import { UpdateResultatPublicationDto } from './dto/create-resultat-publication.dto';

const resultatUploadOptions = {
  storage: memoryStorage(),
  fileFilter: createMimeFilter(RESULTAT_ACCEPTED_MIMES),
  limits: { fileSize: 10 * 1024 * 1024 },
};

function sanitizeFilename(filename: string): string {
  return filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\\w.-]+/g, '_')
    .slice(0, 120);
}

@ApiTags('Résultats')
@Controller('resultats')
export class ResultatsController {
  constructor(private readonly resultsService: ResultsService) {}

  @Post('import')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.RESULTAT_CREATE)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth(API_BEARER_AUTH_NAME)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Importer un fichier de résultat (Excel ou PDF)',
    description:
      'Stocke le fichier (MinIO), crée la publication en brouillon et, pour un fichier .xlsx, analyse les lignes pour prévisualiser l’importation. Aucun résultat individuel n’est enregistré tant que la confirmation n’est pas appelée.',
  })
  @ApiStandardResponse(undefined, {
    status: 201,
    description: 'Publication créée et aperçu retourné',
  })
  @ApiStandardErrors({ auth: true, payload: true })
  @ApiMessage('Fichier importé et analysé avec succès')
  @UseInterceptors(FileInterceptor('fichier', resultatUploadOptions))
  async import(
    @UploadedFile() fichier: Express.Multer.File,
    @Body() dto: CreateResultatPublicationDto,
    @CurrentUser() user: AuthUser,
  ) {
    const { publication, preview } = await this.resultsService.importResultat(
      fichier,
      dto,
      user.userId,
      user.prenom && user.nom ? `${user.prenom} ${user.nom}` : user.email,
      '',
      '/resultats/import',
    );
    return { publication, preview };
  }

  @Post('import/:id/confirmer')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.RESULTAT_CREATE)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth(API_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Confirmer l’importation des résultats individuels',
    description:
      'Enregistre les lignes valides du fichier Excel associé à une publication en brouillon. Les doublons et les lignes invalides sont ignorés sans écrasement silencieux.',
  })
  @ApiParam({ name: 'id', example: 12 })
  @ApiStandardResponse(undefined, { description: SWAGGER_OPERATION_SUCCESS })
  @ApiStandardErrors({ auth: true, notFound: true, conflict: true })
  @ApiMessage('Importation confirmée')
  async confirmer(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.resultsService.confirmerImportation(
      id,
      user.userId,
      user.prenom && user.nom ? `${user.prenom} ${user.nom}` : user.email,
      '',
      `/resultats/import/${id}/confirmer`,
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.RESULTAT_VIEW)
  @ApiBearerAuth(API_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Lister les publications de résultats (back-office)',
    description: 'Liste paginée, filtrable et triable des publications de résultats.',
  })
  @ApiPaginatedResponse(undefined, 'Liste paginée des publications de résultats')
  @ApiStandardErrors({ auth: true })
  @ApiMessage('Publications de résultats récupérées')
  findAll(@Query() query: QueryResultatPublicationDto) {
    return this.resultsService.findAll(query);
  }

  @Get('public')
  @ApiOperation({
    summary: 'Lister les publications de résultats publiées (public)',
    description: 'Liste publique des publications dont le statut est publié.',
  })
  @ApiPaginatedResponse(undefined, 'Liste publique des publications publiées')
  @ApiStandardErrors({ auth: false })
  @ApiMessage('Publications publiques récupérées')
  findPublic(@Query() query: QueryResultatPublicationDto) {
    return this.resultsService.findPublic(query);
  }

  @Get('public/:id')
  @ApiOperation({
    summary: 'Consulter une publication de résultat publiée (public)',
    description:
      'Retourne les métadonnées d’une publication publiée et ses totaux. La liste des lignes individuelles reste protégée.',
  })
  @ApiParam({ name: 'id', example: 12 })
  @ApiStandardResponse(undefined, { description: SWAGGER_OPERATION_SUCCESS })
  @ApiStandardErrors({ auth: false, notFound: true })
  @ApiMessage('Publication de résultat publique récupérée')
  findPublicOne(@Param('id', ParseIntPipe) id: number) {
    return this.resultsService.findPublicOne(id);
  }

  @Get('public/:id/individuels')
  @Public()
  @UseGuards(AllowAllGuard)
  @ApiOperation({
    summary: 'Lister les résultats individuels d’une publication publique',
    description:
      'Liste paginée des résultats individuels d’une publication publiée en mode public. Aucun code de consultation n’est renvoyé.',
  })
  @ApiParam({ name: 'id', example: 12 })
  @ApiPaginatedResponse(undefined, 'Liste publique des résultats individuels')
  @ApiStandardErrors({ auth: false, notFound: true })
  @ApiMessage('Résultats individuels publics récupérés')
  async listerIndividuelsPublics(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: { page?: number; limit?: number; q?: string; statutAcademique?: string },
  ) {
    return this.resultsService.listerIndividuelsPublics(id, query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.RESULTAT_VIEW)
  @ApiBearerAuth(API_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Consulter une publication de résultat',
    description: 'Détail de la publication, avec ses résultats individuels si fichier Excel.',
  })
  @ApiParam({ name: 'id', example: 12 })
  @ApiStandardResponse(undefined, { description: SWAGGER_OPERATION_SUCCESS })
  @ApiStandardErrors({ auth: true, notFound: true })
  @ApiMessage('Publication de résultat récupérée')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.resultsService.findOneWithIndividuels(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.RESULTAT_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth(API_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Modifier les métadonnées d’une publication',
    description: 'Mise à jour partielle d’une publication de résultat.',
  })
  @ApiParam({ name: 'id', example: 12 })
  @ApiStandardResponse(undefined, { description: SWAGGER_OPERATION_SUCCESS })
  @ApiStandardErrors({ auth: true, notFound: true, payload: true })
  @ApiMessage('Publication de résultat mise à jour')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateResultatPublicationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.resultsService.update(
      id,
      dto,
      user.userId,
      user.prenom && user.nom ? `${user.prenom} ${user.nom}` : user.email,
      '',
      `/resultats/${id}`,
    );
  }

  @Post(':id/publier')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.RESULTAT_PUBLISH)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth(API_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Publier un résultat',
    description: 'Passe une publication de brouillon à publiée.',
  })
  @ApiParam({ name: 'id', example: 12 })
  @ApiStandardResponse(undefined, { description: SWAGGER_OPERATION_SUCCESS })
  @ApiStandardErrors({ auth: true, notFound: true, conflict: true })
  @ApiMessage('Résultat publié')
  publier(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.resultsService.changerStatut(
      id,
      ResultatPublicationStatus.PUBLIE,
      user.userId,
      user.prenom && user.nom ? `${user.prenom} ${user.nom}` : user.email,
      '',
      `/resultats/${id}/publier`,
      'publication',
    );
  }

  @Post(':id/depublier')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.RESULTAT_PUBLISH)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth(API_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Dépublier un résultat',
    description: 'Passe une publication publiée à brouillon.',
  })
  @ApiParam({ name: 'id', example: 12 })
  @ApiStandardResponse(undefined, { description: SWAGGER_OPERATION_SUCCESS })
  @ApiStandardErrors({ auth: true, notFound: true })
  @ApiMessage('Résultat dépublié')
  depublier(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.resultsService.changerStatut(
      id,
      ResultatPublicationStatus.BROUILLON,
      user.userId,
      user.prenom && user.nom ? `${user.prenom} ${user.nom}` : user.email,
      '',
      `/resultats/${id}/depublier`,
      'depublication',
    );
  }

  @Post(':id/archiver')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.RESULTAT_PUBLISH)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth(API_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Archiver un résultat',
    description: 'Passe une publication à l’état archivé (retirée de la publication courante).',
  })
  @ApiParam({ name: 'id', example: 12 })
  @ApiStandardResponse(undefined, { description: SWAGGER_OPERATION_SUCCESS })
  @ApiStandardErrors({ auth: true, notFound: true })
  @ApiMessage('Résultat archivé')
  archiver(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.resultsService.changerStatut(
      id,
      ResultatPublicationStatus.ARCHIVE,
      user.userId,
      user.prenom && user.nom ? `${user.prenom} ${user.nom}` : user.email,
      '',
      `/resultats/${id}/archiver`,
      'archivage',
    );
  }

  @Get('modele')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.RESULTAT_VIEW)
  @ApiBearerAuth(API_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Télécharger le modèle de fichier pour l’import de résultats',
    description:
      'Renvoie un fichier Excel (.xlsx) vierge avec les en-têtes de colonnes attendues pour l’importation de résultats individuels.',
  })
  @ApiStandardResponse(undefined, {
    status: 200,
    description: 'Fichier modèle Excel retourné',
  })
  @ApiStandardErrors({ auth: true })
  @ApiMessage('Modèle de fichier retourné')
  @SkipTransform()
  async downloadModele(@Res() res: Response): Promise<void> {
    const { buffer, filename, mimetype, taille } = await this.resultsService.getModeleImport();
    res.setHeader('Content-Type', mimetype);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(taille));
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(buffer);
  }

  @Get(':id/fichier')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.RESULTAT_VIEW)
  @ApiBearerAuth(API_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Télécharger ou prévisualiser le fichier d’une publication',
    description:
      'Renvoie le binaire du fichier. Ajouter `?download=1` pour forcer le téléchargement. Réservé aux utilisateurs autorisés.',
  })
  @ApiParam({ name: 'id', example: 12 })
  @ApiStandardErrors({ auth: true, notFound: true })
  @ApiMessage('Fichier de résultat récupéré')
  @SkipTransform()
  async getFichier(
    @Param('id', ParseIntPipe) id: number,
    @Query('download') download: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename, mimetype, taille, inlineViewable } =
      await this.resultsService.getFichier(id);
    const wantsDownload = download === '1' || download === 'true';
    const disposition = wantsDownload || !inlineViewable ? 'attachment' : 'inline';

    res.setHeader('Content-Type', mimetype);
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${sanitizeFilename(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    res.setHeader('Content-Length', String(taille));
    res.setHeader('X-Document-Inline-Viewable', String(inlineViewable));
    res.setHeader(
      'Access-Control-Expose-Headers',
      'X-Document-Inline-Viewable, Content-Disposition',
    );
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(buffer);
  }

  @Get('public/:id/fichier')
  @ApiOperation({
    summary: 'Télécharger ou prévisualiser un document public',
    description:
      'Renvoie le binaire d’un document officiel publié et explicitement autorisé à la consultation publique. Aucun jeton requis.',
  })
  @ApiParam({ name: 'id', example: 12 })
  @ApiStandardErrors({ auth: false, notFound: true })
  @ApiMessage('Document public récupéré')
  @SkipTransform()
  async getFichierPublic(
    @Param('id', ParseIntPipe) id: number,
    @Query('download') download: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const fichier = await this.resultsService.getFichierPublic(id);
    if (!fichier) {
      res.setHeader('Content-Type', 'application/json');
      res.status(404).send(
        JSON.stringify({
          statusCode: 404,
          message: 'Le document n’est pas disponible ou n’est plus publié.',
          data: null,
          signature: 'ITDCMADA',
          timestamp: new Date().toISOString(),
          path: `/resultats/public/${id}/fichier`,
        }),
      );
      return;
    }

    const wantsDownload = download === '1' || download === 'true';
    const disposition = wantsDownload || !fichier.inlineViewable ? 'attachment' : 'inline';

    res.setHeader('Content-Type', fichier.mimetype);
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${sanitizeFilename(fichier.filename)}"; filename*=UTF-8''${encodeURIComponent(fichier.filename)}`,
    );
    res.setHeader('Content-Length', String(fichier.taille));
    res.setHeader('X-Document-Inline-Viewable', String(fichier.inlineViewable));
    res.setHeader(
      'Access-Control-Expose-Headers',
      'X-Document-Inline-Viewable, Content-Disposition',
    );
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(fichier.buffer);
  }

  @Post(':id/remplacer')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.RESULTAT_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth(API_BEARER_AUTH_NAME)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Remplacer le fichier d’une publication',
    description:
      'Le nouveau fichier est stocké avant la mise à jour en base. L’ancien fichier n’est supprimé qu’après succès de l’opération. La publication repasse en brouillon.',
  })
  @ApiParam({ name: 'id', example: 12 })
  @ApiStandardResponse(undefined, { description: SWAGGER_OPERATION_SUCCESS })
  @ApiStandardErrors({ auth: true, notFound: true, payload: true })
  @ApiMessage('Fichier remplacé')
  @UseInterceptors(FileInterceptor('fichier', resultatUploadOptions))
  async remplacer(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() fichier: Express.Multer.File,
    @Body() dto: Partial<CreateResultatPublicationDto>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.resultsService.remplacerFichier(
      id,
      fichier,
      {
        modeConsultation: dto.modeConsultation as ResultatConsultationMode | undefined,
        autorisePublicationPublique: dto.autorisePublicationPublique,
      },
      user.userId,
      user.prenom && user.nom ? `${user.prenom} ${user.nom}` : user.email,
      '',
      `/resultats/${id}/remplacer`,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.RESULTAT_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth(API_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Supprimer une publication de résultat',
    description: 'Supprime la publication et son fichier de stockage.',
  })
  @ApiParam({ name: 'id', example: 12 })
  @ApiStandardErrors({ auth: true, notFound: true })
  @ApiMessage('Publication de résultat supprimée')
  async supprimer(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    await this.resultsService.supprimer(
      id,
      user.userId,
      user.prenom && user.nom ? `${user.prenom} ${user.nom}` : user.email,
      '',
      `/resultats/${id}`,
    );
  }

  @Get(':id/individuels')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.RESULTAT_VIEW)
  @ApiBearerAuth(API_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Lister les résultats individuels d’une publication',
    description: 'Liste paginée des résultats individuels issus d’un fichier Excel.',
  })
  @ApiParam({ name: 'id', example: 12 })
  @ApiPaginatedResponse(undefined, 'Liste paginée des résultats individuels')
  @ApiStandardErrors({ auth: true, notFound: true })
  @ApiMessage('Résultats individuels récupérés')
  async listerIndividuels(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: { page?: number; limit?: number; q?: string; statutAcademique?: string },
  ) {
    await this.resultsService.findOne(id);
    return this.resultsService.listerIndividuels(id, query);
  }

  @Get('consultation')
  @Public()
  @UseGuards(AllowAllGuard)
  @ApiOperation({
    summary: 'Consulter un résultat individuel (public)',
    description:
      'Consultation individuelle protégée par matricule et code de consultation sécurisé. Retourne uniquement le résultat de l’étudiant demandé.',
  })
  @ApiStandardResponse(undefined, { description: SWAGGER_OPERATION_SUCCESS })
  @ApiStandardErrors({ auth: false, notFound: true })
  @ApiMessage('Résultat individuel récupéré')
  async consulter(
    @Query('matricule') matricule: string | undefined,
    @Query('code') code: string | undefined,
  ) {
    if (!matricule || !code) {
      throw new BadRequestException('Le matricule et le code de consultation sont requis.');
    }
    const resultat = await this.resultsService.consulterIndividuel(matricule, code);
    if (!resultat) {
      throw new NotFoundException(
        'Aucun résultat publié ne correspond à ce matricule et à ce code de consultation.',
      );
    }
    return resultat;
  }
}
