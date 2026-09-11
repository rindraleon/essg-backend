import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { Utilisateur } from '../users/entities/user.entity';
import { PASSWORD_SALT_ROUNDS } from '../users/users.constants';
import { SessionsService } from '../sessions/sessions.service';
import { MailService } from '../mail/mail.service';
import { ActivityLogService } from '../activity-logs/activity-log.service';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import {
  DEFAULT_PASSWORD_MIN_LENGTH,
  PASSWORD_RESET_GENERIC_MESSAGE,
  PASSWORD_RESET_LINK_PATH,
  PASSWORD_RESET_MAX_REQUESTS_PER_HOUR,
  PASSWORD_RESET_TOKEN_BYTES,
  PASSWORD_RESET_TOKEN_TTL_MS,
  RESET_TOKEN_ERROR_MESSAGES,
  type ResetTokenStatus,
} from './password-reset.constants';
import { describeUnmetRules, validatePasswordStrength } from './password-strength.util';

export interface ResetValidationResult {
  valid: boolean;
  status: ResetTokenStatus;
}

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    @InjectRepository(PasswordResetToken)
    private readonly tokenRepo: Repository<PasswordResetToken>,
    @InjectRepository(Utilisateur)
    private readonly userRepo: Repository<Utilisateur>,
    private readonly sessionsService: SessionsService,
    private readonly mailService: MailService,
    private readonly activityLogService: ActivityLogService,
    private readonly configService: ConfigService,
  ) {}

  async requestReset(email: string, ipAddress: string | null): Promise<{ message: string }> {
    const normalized = email.trim().toLowerCase();
    const user = await this.userRepo.findOne({ where: { email: normalized } });

    if (!user || !user.estActif) {
      this.logger.log(
        `Demande de réinitialisation pour un compte inconnu ou inactif (${normalized})`,
      );
      return { message: PASSWORD_RESET_GENERIC_MESSAGE };
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentRequests = await this.tokenRepo.count({
      where: { userId: user.id, createdAt: MoreThan(oneHourAgo) },
    });
    if (recentRequests >= PASSWORD_RESET_MAX_REQUESTS_PER_HOUR) {
      this.logger.warn(`Limite de demandes de réinitialisation atteinte pour ${normalized}`);
      return { message: PASSWORD_RESET_GENERIC_MESSAGE };
    }

    await this.tokenRepo.delete({ userId: user.id, usedAt: IsNull() });

    const rawToken = randomBytes(PASSWORD_RESET_TOKEN_BYTES).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    await this.tokenRepo.save({
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
      usedAt: null,
    });

    const backOfficeUrl = this.configService
      .get<string>('BACK_OFFICE_URL', 'http://localhost:5000')
      .replace(/\/$/, '');
    const resetUrl = `${backOfficeUrl}${PASSWORD_RESET_LINK_PATH}?token=${rawToken}`;

    try {
      await this.mailService.sendPasswordResetEmail(
        normalized,
        user.prenom,
        user.nom,
        resetUrl,
        Math.round(PASSWORD_RESET_TOKEN_TTL_MS / 60000),
      );
    } catch (error) {
      this.logger.warn(
        `Email de réinitialisation non envoyé à ${normalized}`,
        error instanceof Error ? error.message : error,
      );
    }

    await this.logSecurityEvent({
      userId: user.id,
      userName: `${user.prenom} ${user.nom}`,
      action: 'password_reset_requested',
      description: `Demande de réinitialisation du mot de passe pour ${normalized}`,
      endpoint: '/auth/forgot-password',
      statusCode: 201,
      success: true,
      ipAddress,
    });

    return { message: PASSWORD_RESET_GENERIC_MESSAGE };
  }

  async validateToken(token: string): Promise<ResetValidationResult> {
    const record = await this.findTokenRecord(token);
    const status = this.resolveTokenStatus(record);
    return { valid: status === 'valid', status };
  }

  async resetPassword(
    token: string,
    password: string,
    confirmPassword: string,
    ipAddress: string | null,
  ): Promise<{ message: string }> {
    if (password !== confirmPassword) {
      throw new BadRequestException('Les deux mots de passe ne correspondent pas');
    }

    const record = await this.findTokenRecord(token);
    const status = this.resolveTokenStatus(record);
    if (status !== 'valid' || !record) {
      throw new BadRequestException(RESET_TOKEN_ERROR_MESSAGES[status]);
    }

    const user = await this.userRepo.findOne({ where: { id: record.userId } });
    if (!user || !user.estActif) {
      throw new BadRequestException('La réinitialisation est impossible pour ce compte');
    }

    this.assertStrongPassword(password);

    user.motDePasse = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
    await this.userRepo.save(user);

    record.usedAt = new Date();
    await this.tokenRepo.save(record);
    await this.tokenRepo.delete({ userId: user.id, usedAt: IsNull() });

    await this.sessionsService.revokeAllForUser(user.id, user.id, 'password_reset');

    await this.logSecurityEvent({
      userId: user.id,
      userName: `${user.prenom} ${user.nom}`,
      action: 'password_reset_completed',
      description: `Mot de passe réinitialisé et sessions révoquées pour ${user.email}`,
      endpoint: '/auth/reset-password',
      statusCode: 200,
      success: true,
      ipAddress,
    });

    return {
      message:
        'Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.',
    };
  }

  async changePassword(
    userId: number,
    sessionId: string | undefined,
    currentPassword: string,
    newPassword: string,
    confirmPassword: string,
    ipAddress: string | null,
  ): Promise<{ message: string }> {
    if (newPassword !== confirmPassword) {
      throw new BadRequestException('Les deux mots de passe ne correspondent pas');
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const matches = await bcrypt.compare(currentPassword, user.motDePasse);
    if (!matches) throw new UnauthorizedException('Mot de passe actuel incorrect');

    if (currentPassword === newPassword) {
      throw new BadRequestException('Le nouveau mot de passe doit être différent du précédent');
    }

    this.assertStrongPassword(newPassword);

    user.motDePasse = await bcrypt.hash(newPassword, PASSWORD_SALT_ROUNDS);
    await this.userRepo.save(user);

    await this.tokenRepo.delete({ userId: user.id, usedAt: IsNull() });

    const sessions = await this.sessionsService.findByUser(user.id);
    for (const session of sessions) {
      if (session.revokedAt || session.id === sessionId) continue;
      await this.sessionsService.revoke(session.id, user.id, 'password_changed');
    }

    await this.logSecurityEvent({
      userId: user.id,
      userName: `${user.prenom} ${user.nom}`,
      action: 'password_changed',
      description: `Mot de passe modifié depuis le profil pour ${user.email}`,
      endpoint: '/auth/change-password',
      statusCode: 200,
      success: true,
      ipAddress,
    });

    return { message: 'Votre mot de passe a été modifié avec succès.' };
  }

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private async findTokenRecord(token: string): Promise<PasswordResetToken | null> {
    const trimmed = token.trim();
    if (!trimmed) return null;
    return this.tokenRepo.findOne({ where: { tokenHash: this.hashToken(trimmed) } });
  }

  private resolveTokenStatus(record: PasswordResetToken | null): ResetTokenStatus {
    if (!record) return 'invalid';
    if (record.usedAt) return 'used';
    if (record.expiresAt.getTime() <= Date.now()) return 'expired';
    return 'valid';
  }

  private assertStrongPassword(password: string): void {
    const minLength = Number(
      this.configService.get<string>('PASSWORD_MIN_LENGTH') ?? DEFAULT_PASSWORD_MIN_LENGTH,
    );
    const { valid, unmetRules } = validatePasswordStrength(password, minLength);
    if (!valid) {
      throw new BadRequestException(`Mot de passe trop faible : ${describeUnmetRules(unmetRules)}`);
    }
  }

  private async logSecurityEvent(data: {
    userId: number;
    userName: string;
    action: string;
    description: string;
    endpoint: string;
    statusCode: number;
    success: boolean;
    ipAddress: string | null;
  }): Promise<void> {
    try {
      await this.activityLogService.create({
        ...data,
        method: 'POST',
        module: 'auth',
        metadata: null,
      });
    } catch (error) {
      this.logger.warn(
        `Journalisation de sécurité impossible (${data.action})`,
        error instanceof Error ? error.message : error,
      );
    }
  }
}
