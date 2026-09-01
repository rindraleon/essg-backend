import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { memoryStorage } from 'multer';
import { ApiMessage } from '../common/decorators/api-message.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { documentUploadOptions, proofUploadOptions } from '../common/storage/multer.config';
import { StorageService } from '../common/storage/storage.service';
import { AdmissionFileType } from './entities/admission-file.entity';
import { AdmissionsService, type AdmissionUploadedFile } from './admissions.service';
import { CreateAdmissionDto } from './dto/create-admission.dto';
import { QueryAdmissionDto } from './dto/query-admission.dto';
import { UpdateAdmissionStatusDto } from './dto/update-admission-status.dto';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { RateLimit, RATE_LIMITS } from '../infrastructure/rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../infrastructure/rate-limit/rate-limit.guard';
import {
  ApiPaginatedResponse,
  ApiStandardErrors,
  ApiStandardResponse,
} from '../common/swagger/api-response.decorator';

interface AdmissionFiles {
  releveBac?: Express.Multer.File[];
  attestationBac?: Express.Multer.File[];
  releveL3?: Express.Multer.File[];
  bordereau?: Express.Multer.File[];
  demandeInscription?: Express.Multer.File[];
  photoIdentite?: Express.Multer.File[];
  acteEtatCivil?: Express.Multer.File[];
  diplomeBac?: Express.Multer.File[];
  attestationEtablissement?: Express.Multer.File[];
}

const FILE_FIELDS: Array<{ name: keyof AdmissionFiles; maxCount: number }> = [
  { name: 'releveBac', maxCount: 1 },
  { name: 'attestationBac', maxCount: 1 },
  { name: 'releveL3', maxCount: 1 },
  { name: 'bordereau', maxCount: 1 },
  { name: 'demandeInscription', maxCount: 1 },
  { name: 'photoIdentite', maxCount: 1 },
  { name: 'acteEtatCivil', maxCount: 1 },
  { name: 'diplomeBac', maxCount: 1 },
  { name: 'attestationEtablissement', maxCount: 1 },
];

const FILE_PREFIXES: Record<keyof AdmissionFiles, string> = {
  releveBac: 'admissions/releves-bac',
  attestationBac: 'admissions/attestations-bac',
  releveL3: 'admissions/releves-l3',
  bordereau: 'admissions/bordereaux',
  demandeInscription: 'admissions/demandes-inscription',
  photoIdentite: 'admissions/photos-identite',
  acteEtatCivil: 'admissions/actes-etat-civil',
  diplomeBac: 'admissions/diplomes-bac',
  attestationEtablissement: 'admissions/attestations-etablissement',
};

const PROOF_FIELDS = new Set([
  'releveBac',
  'attestationBac',
  'releveL3',
  'bordereau',
  'demandeInscription',
  'photoIdentite',
  'acteEtatCivil',
  'diplomeBac',
  'attestationEtablissement',
]);

const FIELD_TO_FILE_TYPE: Record<keyof AdmissionFiles, AdmissionFileType> = {
  releveBac: AdmissionFileType.RELEVE_BAC,
  attestationBac: AdmissionFileType.ATTESTATION_BAC,
  releveL3: AdmissionFileType.RELEVE_L3,
  bordereau: AdmissionFileType.BORDEREAU,
  demandeInscription: AdmissionFileType.DEMANDE_INSCRIPTION,
  photoIdentite: AdmissionFileType.PHOTO_IDENTITE,
  acteEtatCivil: AdmissionFileType.ACTE_ETAT_CIVIL,
  diplomeBac: AdmissionFileType.DIPLOME_BAC,
  attestationEtablissement: AdmissionFileType.ATTESTATION_ETABLISSEMENT,
};

const admissionUploadOptions = {
  storage: memoryStorage(),
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void,
  ): void => {
    const options = PROOF_FIELDS.has(file.fieldname) ? proofUploadOptions : documentUploadOptions;
    options.fileFilter(_req, file, cb);
  },
  limits: documentUploadOptions.limits,
};

function sanitizeFilename(filename: string): string {
  return filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w.-]+/g, '_')
    .slice(0, 120);
}

@ApiTags('Admissions')
@Controller('admissions')
export class AdmissionsController {
  constructor(
    private readonly admissionsService: AdmissionsService,
    private readonly storageService: StorageService,
  ) {}

  @Post()
  @UseGuards(RateLimitGuard)
  @RateLimit(RATE_LIMITS.admission)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Déposer une candidature (public)',
    description:
      'Formulaire public d’admission en `multipart/form-data`. Les pièces jointes (`releveBac`, `attestationBac`, `releveL3`, `bordereau`, `demandeInscription`, `photoIdentite`, `acteEtatCivil`, `diplomeBac`, `attestationEtablissement`) sont stockées dans l’espace **privé** du bucket et ne sont téléchargeables qu’avec un jeton valide.\n\nLes emails (accusé de réception candidat et notification administrateurs) sont envoyés directement par le service SMTP.\n\n⚠️ Limitation de débit : 3 dépôts par heure et par IP.',
  })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiStandardResponse(undefined, { status: 201, description: 'Candidature enregistrée' })
  @ApiStandardErrors({ auth: false, conflict: true, payload: true })
  @ApiMessage('Candidature enregistrée avec succès')
  @UseInterceptors(FileFieldsInterceptor(FILE_FIELDS, admissionUploadOptions))
  async create(
    @Body() createAdmissionDto: CreateAdmissionDto,
    @UploadedFiles() files?: AdmissionFiles,
  ) {
    const uploaded: Record<string, AdmissionUploadedFile> = {};

    for (const field of FILE_FIELDS) {
      const file = files?.[field.name]?.[0];
      if (!file) continue;
      const result = await this.storageService.uploadPrivate(file.buffer, file.originalname, {
        mimetype: file.mimetype,
        prefix: FILE_PREFIXES[field.name],
        metadata: { 'x-amz-meta-kind': field.name },
      });
      uploaded[FIELD_TO_FILE_TYPE[field.name]] = {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        objectPath: result.objectName,
      };
    }

    return this.admissionsService.create(createAdmissionDto, uploaded);
  }

  @Get('check-duplicate')
  @ApiOperation({
    summary: 'Vérifier un doublon de candidature',
    description:
      'Contrôle si une candidature existe déjà pour ce numéro de bordereau, ou si l’email/le téléphone a déjà été utilisé pour l’année d’admission en cours (une seule candidature autorisée par an). Le numéro d’inscription au baccalauréat n’est plus un critère de détection des doublons.',
  })
  @ApiStandardResponse(undefined, { description: 'Opération effectuée avec succès' })
  @ApiStandardErrors({ auth: false })
  @ApiMessage('Vérification des doublons effectuée')
  checkDuplicate(
    @Query('numeroBordereau') numeroBordereau?: string,
    @Query('email') email?: string,
    @Query('telephone') telephone?: string,
  ) {
    return this.admissionsService.checkDuplicate({
      numeroBordereau,
      email,
      telephone,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Lister les candidatures',
    description: 'Liste paginée et filtrable des candidatures reçues.',
  })
  @ApiPaginatedResponse(undefined, 'Liste paginée signée ITDCMADA')
  @ApiStandardErrors({ auth: true })
  @ApiMessage('Candidatures récupérées')
  findAll(@Query() query: QueryAdmissionDto) {
    return this.admissionsService.findAll(query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('search')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Rechercher une candidature',
    description: "Recherche sur le nom, l'email et le téléphone.",
  })
  @ApiPaginatedResponse(undefined, 'Liste paginée signée ITDCMADA')
  @ApiStandardErrors({ auth: true })
  @ApiMessage('Recherche effectuée')
  search(@Query() query: QueryAdmissionDto) {
    return this.admissionsService.findAll(query);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/documents/:kind')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Télécharger un document de candidature',
    description:
      'Renvoie le binaire du document (`releveBac`, `bordereau`, `demandeInscription`, …). Ajouter `?download=1` pour forcer le téléchargement. Route hors enveloppe JSON : la signature reste dans l’en-tête `X-Api-Signature`.',
  })
  @ApiParam({ name: 'id', example: 12 })
  @ApiParam({ name: 'kind', example: 'releveBac', description: 'Type de document demandé' })
  @SkipTransform()
  async getDocument(
    @Param('id', ParseIntPipe) id: number,
    @Param('kind') kind: string,
    @Query('download') download: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.admissionsService.getDocument(id, kind);
    const wantsDownload = download === '1' || download === 'true';
    const disposition = wantsDownload || !file.inlineViewable ? 'attachment' : 'inline';

    res.setHeader('Content-Type', file.mimetype);
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${sanitizeFilename(file.filename)}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
    );
    res.setHeader('Content-Length', String(file.buffer.length));
    res.setHeader('X-Document-Inline-Viewable', String(file.inlineViewable));
    res.setHeader(
      'Access-Control-Expose-Headers',
      'X-Document-Inline-Viewable, Content-Disposition',
    );
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(file.buffer);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/files')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: "Lister les fichiers d'une candidature",
    description: 'Métadonnées des pièces jointes (nom, type, taille).',
  })
  @ApiStandardResponse(undefined, { description: 'Opération effectuée avec succès' })
  @ApiStandardErrors({ auth: true, notFound: true })
  @ApiMessage('Fichiers de la candidature récupérés')
  getFiles(@Param('id', ParseIntPipe) id: number) {
    return this.admissionsService.getFiles(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/files/:fileId')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Télécharger une pièce jointe',
    description:
      'Renvoie le binaire de la pièce jointe identifiée par `fileId`. Route hors enveloppe JSON (signature dans l’en-tête `X-Api-Signature`).',
  })
  @ApiParam({ name: 'id', example: 12 })
  @ApiParam({ name: 'fileId', example: 3 })
  @SkipTransform()
  async getFile(
    @Param('id', ParseIntPipe) id: number,
    @Param('fileId', ParseIntPipe) fileId: number,
    @Query('download') download: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.admissionsService.getFile(id, fileId);
    const wantsDownload = download === '1' || download === 'true';
    const disposition = wantsDownload || !file.inlineViewable ? 'attachment' : 'inline';

    res.setHeader('Content-Type', file.mimetype);
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${sanitizeFilename(file.filename)}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
    );
    res.setHeader('Content-Length', String(file.buffer.length));
    res.setHeader('X-Document-Inline-Viewable', String(file.inlineViewable));
    res.setHeader(
      'Access-Control-Expose-Headers',
      'X-Document-Inline-Viewable, Content-Disposition',
    );
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(file.buffer);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/files/:fileId')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Supprimer un fichier de candidature',
    description: 'Supprime la pièce jointe du stockage privé et de la base.',
  })
  @ApiStandardResponse(undefined, { description: 'Opération effectuée avec succès' })
  @ApiStandardErrors({ auth: true, notFound: true })
  @ApiMessage('Fichier supprimé')
  removeFile(@Param('id', ParseIntPipe) id: number, @Param('fileId', ParseIntPipe) fileId: number) {
    return this.admissionsService.removeFile(id, fileId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Consulter une candidature',
    description: 'Dossier complet du candidat.',
  })
  @ApiStandardResponse(undefined, { description: 'Opération effectuée avec succès' })
  @ApiStandardErrors({ auth: true, notFound: true })
  @ApiMessage('Candidature récupérée')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.admissionsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/status')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: "Mettre à jour le statut d'une candidature",
    description:
      'Accepte, refuse ou remet en attente une candidature (notification email éventuelle).',
  })
  @ApiStandardResponse(undefined, { description: 'Opération effectuée avec succès' })
  @ApiStandardErrors({ auth: true, notFound: true, conflict: true })
  @ApiMessage('Statut de la candidature mis à jour')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAdmissionStatusDto: UpdateAdmissionStatusDto,
  ) {
    return this.admissionsService.updateStatus(id, updateAdmissionStatusDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Supprimer une candidature',
    description: 'Suppression définitive du dossier et de ses pièces jointes.',
  })
  @ApiStandardResponse(undefined, { description: 'Opération effectuée avec succès' })
  @ApiStandardErrors({ auth: true, notFound: true })
  @ApiMessage('Candidature supprimée')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.admissionsService.remove(id);
  }
}
