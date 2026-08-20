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
import type { Response } from 'express';
import { ApiMessage } from '../common/decorators/api-message.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { documentUploadOptions } from '../common/storage/multer.config';
import { StorageService } from '../common/storage/storage.service';
import { AdmissionsService } from './admissions.service';
import { CreateAdmissionDto } from './dto/create-admission.dto';
import { QueryAdmissionDto } from './dto/query-admission.dto';
import { UpdateAdmissionStatusDto } from './dto/update-admission-status.dto';

interface AdmissionFiles {
  cv?: Express.Multer.File[];
  lettreMotivation?: Express.Multer.File[];
}

function sanitizeFilename(filename: string): string {
  return filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w.\-]+/g, '_')
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
      ],
      documentUploadOptions,
    ),
  )
  async create(
    @Body() createAdmissionDto: CreateAdmissionDto,
    @UploadedFiles() files?: AdmissionFiles,
  ) {
    const cv = files?.cv?.[0];
    const lettre = files?.lettreMotivation?.[0];

    if (cv) {
      const result = await this.storageService.uploadPrivate(cv.buffer, cv.originalname, {
        mimetype: cv.mimetype,
        prefix: 'admissions/cv',
        metadata: { 'x-amz-meta-kind': 'cv' },
      });
      createAdmissionDto.cvPath = result.objectName;
    }
    if (lettre) {
      const result = await this.storageService.uploadPrivate(lettre.buffer, lettre.originalname, {
        mimetype: lettre.mimetype,
        prefix: 'admissions/lettres',
        metadata: { 'x-amz-meta-kind': 'lettre' },
      });
      createAdmissionDto.lettreMotivationPath = result.objectName;
    }

    return this.admissionsService.create(createAdmissionDto);
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
    res.setHeader('Access-Control-Expose-Headers', 'X-Document-Inline-Viewable, Content-Disposition');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(file.buffer);
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
