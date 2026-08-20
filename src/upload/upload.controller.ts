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
import { ApiMessage } from '../common/decorators/api-message.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { imageUploadOptions } from '../common/storage/multer.config';
import { PresignUploadDto } from './dto/presign-upload.dto';
import { UploadService } from './upload.service';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @UseGuards(JwtAuthGuard)
  @Post('image')
  @HttpCode(HttpStatus.CREATED)
  @ApiMessage('Image téléversée avec succès')
  @UseInterceptors(FileInterceptor('file', imageUploadOptions))
  async uploadImage(
    @UploadedFile() file?: Express.Multer.File,
    @Query('folder') folder?: string,
  ) {
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
  @ApiMessage('URL présignée générée')
  async presign(@Body() dto: PresignUploadDto) {
    return this.uploadService.presign(dto);
  }
}
