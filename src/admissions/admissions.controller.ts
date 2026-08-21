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

interface AdmissionFiles {
  cv?: Express.Multer.File[];
  lettreMotivation?: Express.Multer.File[];
  releveBac?: Express.Multer.File[];
  attestationBac?: Express.Multer.File[];
  releveL3?: Express.Multer.File[];
  bordereau?: Express.Multer.File[];
}

const FILE_FIELDS: Array<{ name: keyof AdmissionFiles; maxCount: number }> = [
  { name: 'cv', maxCount: 1 },
  { name: 'lettreMotivation', maxCount: 1 },
  { name: 'releveBac', maxCount: 1 },
  { name: 'attestationBac', maxCount: 1 },
  { name: 'releveL3', maxCount: 1 },
  { name: 'bordereau', maxCount: 1 },
];

const FILE_PREFIXES: Record<keyof AdmissionFiles, string> = {
  cv: 'admissions/cv',
  lettreMotivation: 'admissions/lettres',
  releveBac: 'admissions/releves-bac',
  attestationBac: 'admissions/attestations-bac',
  releveL3: 'admissions/releves-l3',
  bordereau: 'admissions/bordereaux',
};

const PROOF_FIELDS = new Set(['releveBac', 'attestationBac', 'releveL3', 'bordereau']);

const FIELD_TO_FILE_TYPE: Record<keyof AdmissionFiles, AdmissionFileType> = {
  cv: AdmissionFileType.CV,
  lettreMotivation: AdmissionFileType.LETTRE,
  releveBac: AdmissionFileType.RELEVE_BAC,
  attestationBac: AdmissionFileType.ATTESTATION_BAC,
  releveL3: AdmissionFileType.RELEVE_L3,
  bordereau: AdmissionFileType.BORDEREAU,
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

@Controller('admissions')
export class AdmissionsController {
  constructor(
    private readonly admissionsService: AdmissionsService,
    private readonly storageService: StorageService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiMessage('Candidature enregistrée avec succès')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'cv', maxCount: 1 },
        { name: 'lettreMotivation', maxCount: 1 },
        { name: 'releveBac', maxCount: 1 },
        { name: 'attestationBac', maxCount: 1 },
        { name: 'releveL3', maxCount: 1 },
        { name: 'bordereau', maxCount: 1 },
      ],
      admissionUploadOptions,
    ),
  )
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
  @ApiMessage('Vérification des doublons effectuée')
  checkDuplicate(
    @Query('numeroBaccalaureat') numeroBaccalaureat?: string,
    @Query('numeroBordereau') numeroBordereau?: string,
  ) {
    return this.admissionsService.checkDuplicate({ numeroBaccalaureat, numeroBordereau });
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiMessage('Candidatures récupérées')
  findAll(@Query() query: QueryAdmissionDto) {
    return this.admissionsService.findAll(query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('search')
  @ApiMessage('Recherche effectuée')
  search(@Query() query: QueryAdmissionDto) {
    return this.admissionsService.findAll(query);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/documents/:kind')
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
  @ApiMessage('Fichiers de la candidature récupérés')
  getFiles(@Param('id', ParseIntPipe) id: number) {
    return this.admissionsService.getFiles(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/files/:fileId')
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
  @ApiMessage('Fichier supprimé')
  removeFile(@Param('id', ParseIntPipe) id: number, @Param('fileId', ParseIntPipe) fileId: number) {
    return this.admissionsService.removeFile(id, fileId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiMessage('Candidature récupérée')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.admissionsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/status')
  @ApiMessage('Statut de la candidature mis à jour')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAdmissionStatusDto: UpdateAdmissionStatusDto,
  ) {
    return this.admissionsService.updateStatus(id, updateAdmissionStatusDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiMessage('Candidature supprimée')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.admissionsService.remove(id);
  }
}
