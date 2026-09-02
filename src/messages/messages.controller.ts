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
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateMessageDto, UpdateMessageDto } from './dto/create-message.dto';
import { QueryMessageDto } from './dto/query-message.dto';
import { ReplyMessageDto } from './dto/reply-message.dto';
import { MessagesService } from './messages.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RateLimit, RATE_LIMITS } from '../infrastructure/rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../infrastructure/rate-limit/rate-limit.guard';
import {
  ApiPaginatedResponse,
  ApiStandardErrors,
  ApiStandardResponse,
} from '../common/swagger/api-response.decorator';

@ApiTags('Messages de contact')
@Controller('messages')
export class MessagesController {
  constructor(private readonly service: MessagesService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Lister les messages',
    description: 'Boîte de réception du Back-Office (filtrable et paginée).',
  })
  @ApiPaginatedResponse(undefined, 'Liste paginée signée ITDCMADA')
  @ApiStandardErrors({ auth: true })
  @ApiMessage('Messages récupérés')
  findAll(@Query() query: QueryMessageDto) {
    if (query.q?.trim()) {
      return this.service.search(query.q, query);
    }
    return this.service.findAll(query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('search')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Rechercher un message',
    description: "Recherche sur l'expéditeur, le sujet et le contenu.",
  })
  @ApiPaginatedResponse(undefined, 'Liste paginée signée ITDCMADA')
  @ApiStandardErrors({ auth: true })
  @ApiMessage('Recherche effectuée')
  search(@Query() query: QueryMessageDto) {
    return this.service.search(query.q ?? '', query);
  }

  @Get('verify-email')
  @UseGuards(RateLimitGuard)
  @RateLimit(RATE_LIMITS.verifyEmail)
  @ApiOperation({
    summary: 'Vérifier une adresse email (public)',
    description:
      "Vérifie côté serveur qu'une adresse email est syntaxiquement valide et que son domaine peut recevoir des messages (DNS MX, domaines jetables).\n\n⚠️ Limitation de débit : 20 vérifications par tranche de 5 minutes et par IP.",
  })
  @ApiStandardResponse(undefined, { description: 'Vérification effectuée' })
  @ApiStandardErrors({ auth: false })
  @ApiMessage('Vérification effectuée')
  verifyEmail(@Query('email') email?: string) {
    return this.service.verifyEmail(email);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Consulter un message',
    description: "Détail d'un message et de sa réponse éventuelle.",
  })
  @ApiStandardResponse(undefined, { description: 'Opération effectuée avec succès' })
  @ApiStandardErrors({ auth: true, notFound: true })
  @ApiMessage('Message récupéré')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @UseGuards(RateLimitGuard)
  @RateLimit(RATE_LIMITS.contact)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Envoyer un message (public)',
    description:
      "Endpoint public du formulaire de contact du site vitrine. Le message est enregistré en base, puis l'accusé de réception et la notification aux administrateurs sont envoyés directement par le service SMTP.\n\n⚠️ Limitation de débit : 5 envois par tranche de 10 minutes et par IP.",
  })
  @ApiStandardResponse(undefined, { status: 201, description: 'Ressource créée' })
  @ApiStandardErrors({ auth: false, conflict: true })
  @ApiMessage('Message créé avec succès')
  create(@Body() dto: CreateMessageDto) {
    return this.service.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/reply')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Répondre à un message',
    description: "Envoie la réponse par email et archive l'échange.",
  })
  @ApiStandardResponse(undefined, { description: 'Opération effectuée avec succès' })
  @ApiStandardErrors({ auth: true, notFound: true })
  @ApiMessage('Réponse envoyée')
  reply(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReplyMessageDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.reply(id, dto, user);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Mettre à jour un message',
    description: 'Permet notamment de marquer un message comme lu ou traité.',
  })
  @ApiStandardResponse(undefined, { description: 'Opération effectuée avec succès' })
  @ApiStandardErrors({ auth: true, notFound: true, conflict: true })
  @ApiMessage('Message mis à jour')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMessageDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Supprimer un message',
    description: 'Suppression définitive du message.',
  })
  @ApiStandardResponse(undefined, { description: 'Opération effectuée avec succès' })
  @ApiStandardErrors({ auth: true, notFound: true })
  @ApiMessage('Message supprimé')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
