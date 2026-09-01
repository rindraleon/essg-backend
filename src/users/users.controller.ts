import {
  BadRequestException,
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
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ApiMessage } from '../common/decorators/api-message.decorator';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
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
import { CreateUtilisateurDto } from './dto/create-user.dto';
import { UpdateUtilisateurDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

interface AuthUser {
  userId: number;
  role: string;
}

const AVATAR_FIELDS = [
  { name: 'avatar', maxCount: 1 },
  { name: 'file', maxCount: 1 },
  { name: 'image', maxCount: 1 },
];

type UploadedAvatarFiles = Record<string, Express.Multer.File[] | undefined>;

@ApiTags('Utilisateurs')
@ApiBearerAuth('access-token')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(
    private readonly service: UsersService,
    private readonly storageService: StorageService,
    private readonly imageUploadService: ImageUploadService,
  ) {}

  @Roles('admin')
  @Get()
  @ApiOperation({
    summary: 'Lister les utilisateurs',
    description:
      'Liste paginée des comptes du Back-Office. Réservé au rôle `admin`. Réponse signée **ITDCMADA**.',
  })
  @ApiPaginatedResponse(undefined, 'Liste paginée des utilisateurs (mot de passe jamais exposé)')
  @ApiStandardErrors()
  @ApiMessage('Utilisateurs récupérés')
  findAll(@Query() paginationDto: PaginationQueryDto) {
    return this.service.findAll(paginationDto);
  }

  @Roles('admin')
  @Get('search')
  @ApiOperation({
    summary: 'Rechercher des utilisateurs',
    description: 'Recherche insensible à la casse sur le nom, le prénom et l’email.',
  })
  @ApiQuery({ name: 'q', required: false, example: 'rakoto', description: 'Terme recherché' })
  @ApiPaginatedResponse(undefined, 'Résultats de recherche paginés')
  @ApiStandardErrors()
  @ApiMessage('Recherche effectuée')
  search(@Query('q') query: string, @Query() paginationDto: PaginationQueryDto) {
    return this.service.search(query, paginationDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Consulter un utilisateur',
    description:
      'Un utilisateur non administrateur ne peut consulter que son propre profil (403 sinon).',
  })
  @ApiParam({ name: 'id', example: 1 })
  @ApiStandardResponse(undefined, { description: 'Utilisateur trouvé' })
  @ApiStandardErrors({ notFound: true })
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
  @ApiOperation({
    summary: 'Créer un utilisateur',
    description:
      'Crée un compte et envoie un email de bienvenue contenant les identifiants. Rôle `admin` requis.',
  })
  @ApiStandardResponse(undefined, {
    status: HttpStatus.CREATED,
    description: 'Utilisateur créé',
  })
  @ApiStandardErrors({ conflict: true })
  @ApiMessage('Utilisateur créé avec succès')
  create(@Body() dto: CreateUtilisateurDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Mettre à jour un utilisateur',
    description: 'Un utilisateur non administrateur ne peut modifier que son propre profil.',
  })
  @ApiParam({ name: 'id', example: 1 })
  @ApiStandardResponse(undefined, { description: 'Utilisateur mis à jour' })
  @ApiStandardErrors({ notFound: true, conflict: true })
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
  @ApiOperation({
    summary: 'Téléverser la photo de profil',
    description: [
      'Envoi `multipart/form-data`, champ **`avatar`** (les alias `file` et `image` sont acceptés).',
      '',
      'Pipeline appliqué :',
      '`Back-Office → Multer (mémoire) → validation MIME + magic bytes → Sharp (rotation EXIF, redimensionnement 512px, WebP q82) → MinIO (`avatars/`) → vérification de l’objet → URL `/media/avatars/<uuid>.webp` → base de données`.',
      '',
      "L'ancienne photo est supprimée du stockage **après** l'enregistrement réussi de la nouvelle.",
      "La réponse contient l'utilisateur complet, avec le champ `avatar` déjà à jour : le Back-Office peut l'afficher immédiatement.",
    ].join('\n'),
  })
  @ApiParam({ name: 'id', example: 1 })
  @ApiImageUpload('avatar')
  @ApiStandardResponse(undefined, {
    description: 'Avatar converti en WebP, stocké et enregistré (URL `.webp`)',
  })
  @ApiStandardErrors({ notFound: true, payload: true })
  @ApiMessage('Avatar mis à jour')
  @UseInterceptors(FileFieldsInterceptor(AVATAR_FIELDS, imageUploadOptions))
  async uploadAvatar(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() files: UploadedAvatarFiles,
    @Request() req: { user: AuthUser },
  ) {
    if (req.user.role !== 'admin' && req.user.userId !== id) {
      throw new ForbiddenException('Vous ne pouvez modifier que votre propre avatar');
    }

    const file = files?.avatar?.[0] ?? files?.file?.[0] ?? files?.image?.[0];
    if (!file) {
      throw new BadRequestException(
        'Aucun fichier reçu. Envoyez une image dans le champ « avatar » (JPG, PNG, GIF ou WebP, 5 Mo max).',
      );
    }

    const current = await this.service.findOne(id);

    const stored = await this.imageUploadService.upload(file, {
      prefix: STORAGE_PREFIXES.avatars,
      preset: 'avatar',
      replaceUrl: current.avatar,
    });

    return this.service.updateAvatar(id, stored.url);
  }

  @Roles('admin')
  @Delete(':id')
  @ApiOperation({
    summary: 'Supprimer un utilisateur',
    description: 'Supprime le compte puis la photo de profil associée dans le stockage objet.',
  })
  @ApiParam({ name: 'id', example: 1 })
  @ApiStandardResponse(undefined, { description: 'Utilisateur supprimé' })
  @ApiStandardErrors({ notFound: true })
  @ApiMessage('Utilisateur supprimé')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const current = await this.service.findOne(id);
    await this.service.remove(id);
    await this.storageService.deleteStoredRef(current.avatar);
  }
}
