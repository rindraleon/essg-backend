import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { RateLimit, RATE_LIMITS } from '../infrastructure/rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../infrastructure/rate-limit/rate-limit.guard';
import { ApiMessage } from '../common/decorators/api-message.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiStandardErrors, ApiStandardResponse } from '../common/swagger/api-response.decorator';

interface AuthUser {
  userId: number;
  email: string;
}

@ApiTags('Authentification')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Post('verify')
  @ApiBearerAuth('access-token')
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
  @ApiBearerAuth('access-token')
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
}
