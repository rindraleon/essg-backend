import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  Request,
  UseGuards,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { RateLimit, RATE_LIMITS } from '../infrastructure/rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../infrastructure/rate-limit/rate-limit.guard';
import { ApiMessage } from '../common/decorators/api-message.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiStandardErrors, ApiStandardResponse } from '../common/swagger/api-response.decorator';
import { SessionsService } from '../sessions/sessions.service';
import { toSessionView } from '../sessions/session.mapper';
import { RefreshTokenDto } from './dto/refresh-token.dto';

const OK_DESCRIPTION = 'Operation effectuee avec succes';
const ACCESS_TOKEN_AUTH = 'access-token';

interface AuthUser {
  userId: number;
  email: string;
  sessionId?: string;
}

function readClientContext(req: ExpressRequest) {
  const userAgent = req.headers['user-agent'] ?? null;
  return {
    ipAddress: req.ip ?? null,
    deviceName: typeof userAgent === 'string' ? userAgent.slice(0, 120) : null,
  };
}

@ApiTags('Authentification')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionsService: SessionsService,
  ) {}

  @Post('login')
  @UseGuards(RateLimitGuard)
  @RateLimit(RATE_LIMITS.login)
  @ApiOperation({
    summary: 'Se connecter',
    description:
      "Authentifie un utilisateur du Back-Office et renvoie un jeton JWT (`data.accessToken`) à placer dans l'en-tête `Authorization: Bearer <token>`.\n\n⚠️ Limitation de débit : 10 tentatives par tranche de 5 minutes et par couple IP + email (`429` au-delà, en-tête `Retry-After`).",
  })
  @ApiStandardResponse(undefined, { description: 'Opération effectuée avec succès' })
  @ApiStandardErrors({ auth: false })
  @ApiMessage('Connexion réussie')
  async login(@Body() dto: LoginDto, @Req() req: ExpressRequest) {
    return this.authService.login(dto.email, dto.password, readClientContext(req));
  }

  @Post('refresh')
  @UseGuards(RateLimitGuard)
  @RateLimit(RATE_LIMITS.login)
  @ApiOperation({
    summary: "Renouveler le jeton d'acces",
    description:
      'Echange un refresh token contre un nouveau couple de jetons. Le refresh consomme est invalide (rotation).',
  })
  @ApiStandardResponse(undefined, { description: OK_DESCRIPTION })
  @ApiStandardErrors({ auth: false })
  @ApiMessage('Jeton renouvele')
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('verify')
  @ApiBearerAuth(ACCESS_TOKEN_AUTH)
  @ApiOperation({
    summary: 'Vérifier la session',
    description: 'Indique si le jeton fourni est encore valide.',
  })
  @ApiStandardResponse(undefined, { description: 'Opération effectuée avec succès' })
  @ApiStandardErrors({ auth: true })
  @ApiMessage('Session valide')
  verify(@Request() req: { user: AuthUser }) {
    return { valid: true, user: req.user };
  }

  @UseGuards(JwtAuthGuard)
  @Post('me')
  @ApiBearerAuth(ACCESS_TOKEN_AUTH)
  @ApiOperation({
    summary: 'Profil de la session courante',
    description: "Renvoie l'identité portée par le jeton JWT.",
  })
  @ApiStandardResponse(undefined, { description: 'Opération effectuée avec succès' })
  @ApiStandardErrors({ auth: true })
  @ApiMessage('Profil récupéré')
  me(@Request() req: { user: AuthUser }) {
    return req.user;
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @ApiBearerAuth(ACCESS_TOKEN_AUTH)
  @ApiOperation({
    summary: 'Se deconnecter',
    description: 'Revoque uniquement la session courante ; les autres appareils restent connectes.',
  })
  @ApiStandardResponse(undefined, { description: OK_DESCRIPTION })
  @ApiStandardErrors({ auth: true })
  @ApiMessage('Deconnexion reussie')
  async logout(@Request() req: { user: AuthUser }) {
    return this.authService.logout(req.user.userId, req.user.sessionId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('session')
  @ApiBearerAuth(ACCESS_TOKEN_AUTH)
  @ApiOperation({ summary: 'Session courante' })
  @ApiStandardResponse(undefined, { description: OK_DESCRIPTION })
  @ApiStandardErrors({ auth: true })
  @ApiMessage('Session recuperee')
  async currentSession(@Request() req: { user: AuthUser }) {
    const sessionId = req.user.sessionId;
    const session = sessionId ? await this.sessionsService.findById(sessionId) : null;
    if (!session) throw new NotFoundException('Session introuvable');
    return toSessionView(session, sessionId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  @ApiBearerAuth(ACCESS_TOKEN_AUTH)
  @ApiOperation({ summary: 'Mes sessions (multi-appareils)' })
  @ApiStandardResponse(undefined, { description: OK_DESCRIPTION })
  @ApiStandardErrors({ auth: true })
  @ApiMessage('Sessions recuperees')
  async mySessions(@Request() req: { user: AuthUser }) {
    const sessions = await this.sessionsService.findByUser(req.user.userId);
    return sessions.map((session) => toSessionView(session, req.user.sessionId));
  }

  @UseGuards(JwtAuthGuard)
  @Post('sessions/:sessionId/revoke')
  @ApiBearerAuth(ACCESS_TOKEN_AUTH)
  @ApiOperation({ summary: 'Deconnecter un de mes autres appareils' })
  @ApiStandardResponse(undefined, { description: OK_DESCRIPTION })
  @ApiStandardErrors({ auth: true })
  @ApiMessage('Session revoquee')
  async revokeMySession(@Request() req: { user: AuthUser }, @Param('sessionId') sessionId: string) {
    const session = await this.sessionsService.findById(sessionId);
    if (!session || session.userId !== req.user.userId) {
      throw new NotFoundException('Session introuvable');
    }
    const revoked = await this.sessionsService.revoke(sessionId, req.user.userId, 'user_revoke');
    return { revoked };
  }
}
