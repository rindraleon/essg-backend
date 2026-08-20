import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService, JwtPayload } from '../../auth/auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
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

  async validate(payload: JwtPayload): Promise<{
    userId: number;
    email: string;
    role: string;
    prenom: string;
    nom: string;
    avatar?: string;
  }> {
    const isValid = await this.authService.validateToken(payload);
    if (!isValid) throw new UnauthorizedException('Session invalide ou expirée');

    const user = await this.authService.getUserForAuth(payload.sub, payload.email);

    if (!user) throw new UnauthorizedException('Utilisateur introuvable ou inactif');

    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      prenom: user.prenom,
      nom: user.nom,
      avatar: user.avatar || undefined,
    };
  }
}
