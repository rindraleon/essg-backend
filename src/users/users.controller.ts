import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiMessage } from '../common/decorators/api-message.decorator';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { imageUploadOptions } from '../common/storage/multer.config';
import { StorageService } from '../common/storage/storage.service';
import { CreateUtilisateurDto } from './dto/create-user.dto';
import { UpdateUtilisateurDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

interface AuthUser {
  userId: number;
  role: string;
}

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(
    private readonly service: UsersService,
    private readonly storageService: StorageService,
  ) {}

  @Roles('admin')
  @Get()
  @ApiMessage('Utilisateurs récupérés')
  findAll(@Query() paginationDto: PaginationQueryDto) {
    return this.service.findAll(paginationDto);
  }

  @Roles('admin')
  @Get('search')
  @ApiMessage('Recherche effectuée')
  search(@Query('q') query: string, @Query() paginationDto: PaginationQueryDto) {
    return this.service.search(query, paginationDto);
  }

  @Get(':id')
  @ApiMessage('Utilisateur récupéré')
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req: { user: AuthUser }) {
    if (req.user.role !== 'admin' && req.user.userId !== id) {
      throw new ForbiddenException('Vous ne pouvez consulter que votre propre profil');
    }
    return this.service.findOne(id);
  }

  @Roles('admin')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiMessage('Utilisateur créé avec succès')
  create(@Body() dto: CreateUtilisateurDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @ApiMessage('Utilisateur mis à jour')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUtilisateurDto,
    @Request() req: { user: AuthUser },
  ) {
    if (req.user.role !== 'admin' && req.user.userId !== id) {
      throw new ForbiddenException('Vous ne pouvez modifier que votre propre profil');
    }
    return this.service.update(id, dto);
  }

  @Post(':id/avatar')
  @ApiMessage('Avatar mis à jour')
  @UseInterceptors(FileInterceptor('avatar', imageUploadOptions))
  async uploadAvatar(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: { user: AuthUser },
  ) {
    if (req.user.role !== 'admin' && req.user.userId !== id) {
      throw new ForbiddenException('Vous ne pouvez modifier que votre propre avatar');
    }
    if (!file) {
      throw new ForbiddenException('Aucun fichier fourni. Envoyez une image (JPG, PNG, GIF ou WebP).');
    }
    const result = await this.storageService.upload(file.buffer, file.originalname, {
      mimetype: file.mimetype,
    });
    return this.service.updateAvatar(id, result.url);
  }

  @Roles('admin')
  @Delete(':id')
  @ApiMessage('Utilisateur supprimé')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const current = await this.service.findOne(id);
    await this.service.remove(id);
    await this.storageService.deleteStoredRef(current.avatar);
  }
}
