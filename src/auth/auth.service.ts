import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Utilisateur } from '../users/entities/user.entity';
import { SessionsService, SessionContext } from '../sessions/sessions.service';
import { SessionEventsService } from '../sessions/session-events.service';
import { ACCESS_TOKEN_TTL, SESSION_ERRORS } from '../sessions/sessions.constants';
import { JwtPayload } from './jwt-payload.interface';

export interface AuthPayload {
  accessToken: string;
  refreshToken: string;
  email: string;
  sessionId: string;
  expiresAt: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(Utilisateur)
    private readonly userRepo: Repository<Utilisateur>,
    private readonly sessionsService: SessionsService,
    private readonly sessionEvents: SessionEventsService,
  ) {}

  async validateUser(email: string, password: string): Promise<Utilisateur | null> {
    const user = await this.userRepo.findOne({ where: { email: email.toLowerCase() } });
    if (!user) return null;

    const isMatch = await bcrypt.compare(password, user.motDePasse);
    if (!isMatch) return null;

    return user;
  }

  private signAccessToken(user: Utilisateur, sessionId: string): string {
    const payload: JwtPayload = {
      email: user.email,
      sub: user.id,
      sid: sessionId,
      role: user.role,
    };
    return this.jwtService.sign(payload, { expiresIn: ACCESS_TOKEN_TTL });
  }

  async login(email: string, password: string, context: SessionContext = {}): Promise<AuthPayload> {
    const user = await this.validateUser(email, password);
    if (!user) throw new UnauthorizedException('Identifiants invalides');
    if (!user.estActif) throw new UnauthorizedException(SESSION_ERRORS.accountDisabled);

    const { session, refreshToken } = await this.sessionsService.create(user.id, context);
    await this.sessionEvents.emitSessionChanged(user.id, session.id, 'session.created', 'active');

    return {
      accessToken: this.signAccessToken(user, session.id),
      refreshToken,
      email: user.email,
      sessionId: session.id,
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  async refresh(refreshToken: string): Promise<AuthPayload> {
    const session = await this.sessionsService.findByRefreshToken(refreshToken);
    if (!session) throw new UnauthorizedException(SESSION_ERRORS.invalidRefresh);

    const valid = await this.sessionsService.findValidById(session.id);
    if (!valid) throw new UnauthorizedException(SESSION_ERRORS.invalidRefresh);

    const user = await this.userRepo.findOne({ where: { id: session.userId } });
    if (!user || !user.estActif) {
      await this.sessionsService.revoke(session.id, null, 'account_disabled');
      throw new UnauthorizedException(SESSION_ERRORS.accountDisabled);
    }

    const rotated = await this.sessionsService.rotateRefreshToken(valid);
    const refreshed = await this.sessionsService.findById(session.id);
    await this.sessionEvents.emitSessionChanged(user.id, session.id, 'session.touched', 'active');

    return {
      accessToken: this.signAccessToken(user, session.id),
      refreshToken: rotated,
      email: user.email,
      sessionId: session.id,
      expiresAt: (refreshed?.expiresAt ?? valid.expiresAt).toISOString(),
    };
  }

  async logout(userId: number, sessionId?: string): Promise<{ loggedOut: boolean }> {
    if (!sessionId) return { loggedOut: false };
    const revoked = await this.sessionsService.revoke(sessionId, userId, 'logout');
    if (revoked) {
      await this.sessionEvents.emitSessionChanged(userId, sessionId, 'session.logout', 'revoked');
    }
    return { loggedOut: revoked };
  }

  async validateToken(payload: JwtPayload): Promise<boolean> {
    const user = await this.userRepo.findOne({
      where: { id: payload.sub, email: payload.email },
    });
    if (!user || !user.estActif) return false;
    if (!payload.sid) return false;
    return (await this.sessionsService.findValidById(payload.sid)) !== null;
  }

  async getUserById(id: number) {
    return this.userRepo.findOne({ where: { id }, select: ['id', 'email', 'role'] });
  }

  async getUserForAuth(id: number, email: string) {
    return this.userRepo.findOne({
      where: { id, email },
      select: ['id', 'email', 'role', 'prenom', 'nom', 'avatar', 'estActif'],
    });
  }
}
