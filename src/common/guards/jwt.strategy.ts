import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../../auth/auth.service';
import { JwtPayload } from '../../auth/jwt-payload.interface';
import { SessionsService } from '../../sessions/sessions.service';

export interface AuthenticatedUser {
  userId: number;
  email: string;
  role: string;
  prenom: string;
  nom: string;
  avatar?: string;
  sessionId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly sessionsService: SessionsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>(
        'JWT_SECRET',
        'essg-default-secret-key-change-in-production',
      ),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const isValid = await this.authService.validateToken(payload);
    if (!isValid) throw new UnauthorizedException('Session invalide ou expirée');

    const user = await this.authService.getUserForAuth(payload.sub, payload.email);
    if (!user) throw new UnauthorizedException('Utilisateur introuvable ou inactif');

    if (payload.sid) await this.sessionsService.touch(payload.sid);

    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      prenom: user.prenom,
      nom: user.nom,
      avatar: user.avatar || undefined,
      sessionId: payload.sid,
    };
  }
}
