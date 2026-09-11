import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RateLimit, RATE_LIMITS } from '../infrastructure/rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../infrastructure/rate-limit/rate-limit.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ApiMessage } from '../common/decorators/api-message.decorator';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { ApiStandardErrors, ApiStandardResponse } from '../common/swagger/api-response.decorator';
import { SWAGGER_OPERATION_SUCCESS } from '../common/swagger/swagger.constants';
import { PasswordResetService } from './password-reset.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ValidateResetTokenDto } from './dto/validate-reset-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { PASSWORD_RESET_GENERIC_MESSAGE } from './password-reset.constants';

const OK_DESCRIPTION = 'Operation effectuee avec succes';

@ApiTags('Authentification')
@Controller('auth')
export class PasswordController {
  constructor(private readonly passwordResetService: PasswordResetService) {}

  @Post('forgot-password')
  @UseGuards(RateLimitGuard)
  @RateLimit(RATE_LIMITS.passwordResetRequest)
  @ApiOperation({
    summary: 'Demander un lien de réinitialisation du mot de passe',
    description:
      'Envoie un lien de réinitialisation à usage unique (valable 30 minutes) si l’adresse correspond à un compte actif. La réponse est volontairement identique que le compte existe ou non, afin d’empêcher l’énumération des comptes.\n\n⚠️ Limitation de débit : 3 demandes par tranche de 15 minutes et par couple IP + email.',
  })
  @ApiStandardResponse(undefined, { description: OK_DESCRIPTION })
  @ApiStandardErrors({ auth: false })
  @ApiMessage(PASSWORD_RESET_GENERIC_MESSAGE)
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: ExpressRequest) {
    return this.passwordResetService.requestReset(dto.email, req.ip ?? null);
  }

  @Post('reset-password/validate')
  @UseGuards(RateLimitGuard)
  @RateLimit(RATE_LIMITS.passwordResetValidate)
  @ApiOperation({
    summary: 'Vérifier la validité d’un token de réinitialisation',
    description:
      'Indique si le token est utilisable (`valid`) ou non, avec le motif : `expired`, `used` ou `invalid`.',
  })
  @ApiStandardResponse(undefined, { description: OK_DESCRIPTION })
  @ApiStandardErrors({ auth: false })
  @ApiMessage('Validité du token vérifiée')
  async validateResetToken(@Body() dto: ValidateResetTokenDto) {
    return this.passwordResetService.validateToken(dto.token);
  }

  @Post('reset-password')
  @UseGuards(RateLimitGuard)
  @RateLimit(RATE_LIMITS.passwordResetConfirm)
  @ApiOperation({
    summary: 'Réinitialiser le mot de passe avec un token',
    description:
      'Valide le token, applique le nouveau mot de passe (politique de robustesse contrôlée), invalide le token et tous les tokens actifs du compte, puis révoque toutes les sessions existantes.',
  })
  @ApiStandardResponse(undefined, { description: SWAGGER_OPERATION_SUCCESS })
  @ApiStandardErrors({ auth: false })
  @ApiMessage('Mot de passe réinitialisé')
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: ExpressRequest) {
    return this.passwordResetService.resetPassword(
      dto.token,
      dto.password,
      dto.confirmPassword,
      req.ip ?? null,
    );
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Changer son mot de passe (utilisateur authentifié)',
    description:
      'Vérifie le mot de passe actuel puis applique le nouveau (politique de robustesse contrôlée). Les autres sessions de l’utilisateur sont révoquées ; la session courante est conservée.',
  })
  @ApiStandardResponse(undefined, { description: OK_DESCRIPTION })
  @ApiMessage('Mot de passe modifié')
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Req() req: ExpressRequest,
  ) {
    return this.passwordResetService.changePassword(
      user.userId,
      user.sessionId,
      dto.currentPassword,
      dto.newPassword,
      dto.confirmPassword,
      req.ip ?? null,
    );
  }
}
