import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ApiMessage } from '../common/decorators/api-message.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { imageUploadOptions } from '../common/storage/multer.config';
import { STORAGE_PREFIXES } from '../common/storage/storage.constants';
import {
  ApiImageUpload,
  ApiStandardErrors,
  ApiStandardResponse,
} from '../common/swagger/api-response.decorator';
import { PresignUploadDto } from './dto/presign-upload.dto';
import { UploadService } from './upload.service';

@ApiTags('Upload & médias')
@ApiBearerAuth('access-token')
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @UseGuards(JwtAuthGuard)
  @Post('image')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Téléverser une image (pipeline WebP)',
    description: [
      'Point d’entrée unique des images du Back-Office : couverture d’actualité, image de projet,',
      'galerie de projet, visuel de formation, photo d’équipe…',
      '',
      '```text',
      'Upload original → validation (MIME + signature binaire) → Sharp',
      '  → rotation EXIF → redimensionnement → WebP → MinIO → URL /media/...webp',
      '```',
      '',
      'Le dossier de destination (`folder`) détermine automatiquement le preset',
      'd’optimisation (dimensions maximales et qualité).',
      '',
      'La réponse renvoie l’URL définitive **en `.webp`** : c’est cette valeur qui doit être',
      'enregistrée telle quelle en base, sans reconstruire le chemin côté client.',
    ].join('\n'),
  })
  @ApiQuery({
    name: 'folder',
    required: false,
    enum: Object.values(STORAGE_PREFIXES),
    example: 'news',
    description: 'Dossier logique de stockage (détermine le preset d’optimisation).',
  })
  @ApiImageUpload('file')
  @ApiStandardResponse(undefined, {
    status: HttpStatus.CREATED,
    description:
      'Image optimisée et stockée. `data.url` = `/media/<dossier>/<uuid>.webp`, `data.savedPercent` = gain de poids.',
  })
  @ApiStandardErrors({ payload: true })
  @ApiMessage('Image téléversée avec succès')
  @UseInterceptors(FileInterceptor('file', imageUploadOptions))
  async uploadImage(@UploadedFile() file?: Express.Multer.File, @Query('folder') folder?: string) {
    if (!file) {
      throw new BadRequestException(
        'Aucun fichier fourni. Envoyez un champ « file » (JPG, PNG, GIF ou WebP, 5 Mo max).',
      );
    }
    return this.uploadService.uploadImage(file, folder);
  }

  @UseGuards(JwtAuthGuard)
  @Post('presign')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Obtenir une URL présignée (upload direct)',
    description:
      'Génère une URL PUT temporaire vers le stockage objet pour les gros fichiers. ⚠️ Les fichiers envoyés directement ne passent pas par le pipeline Sharp : réservez ce mode aux documents.',
  })
  @ApiStandardResponse(undefined, {
    status: HttpStatus.CREATED,
    description: 'URL présignée générée (valable 10 minutes)',
  })
  @ApiStandardErrors({ payload: true })
  @ApiMessage('URL présignée générée')
  async presign(@Body() dto: PresignUploadDto) {
    return this.uploadService.presign(dto);
  }
}
