import { Injectable, Logger, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Utilisateur } from '../users/entities/user.entity';

export interface AuthPayload {
  accessToken: string;
  email: string;
}

export interface JwtPayload {
  email: string;
  sub: number;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(Utilisateur)
    private readonly userRepo: Repository<Utilisateur>,
  ) {}

  async onModuleInit() {
    const adminEmail = this.configService.get<string>('ADMIN_EMAIL', 'admin@essg.sn');
    const adminPassword = this.configService.get<string>('ADMIN_PASSWORD', 'Admin@2026');

    const existingAdmin = await this.userRepo.findOne({
      where: { email: adminEmail },
    });

    if (!existingAdmin) {
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(adminPassword, saltRounds);

      const admin = this.userRepo.create({
        email: adminEmail,
        motDePasse: passwordHash,
        prenom: 'Admin',
        nom: 'ESSGG',
        role: 'admin',
        estActif: true,
      });

      await this.userRepo.save(admin);
      this.logger.log(`Compte administrateur par défaut créé: ${adminEmail}`);
    } else {
      this.logger.log(`Compte administrateur déjà existant: ${adminEmail}`);
    }
  }

  async validateUser(
    email: string,
    password: string,
  ): Promise<{ id: number; email: string; role: string } | null> {
    const user = await this.userRepo.findOne({
      where: { email: email.toLowerCase() },
    });

    if (!user) return null;

    const isMatch = await bcrypt.compare(password, user.motDePasse);
    if (!isMatch) return null;

    return { id: user.id, email: user.email, role: user.role };
  }

  async login(email: string, password: string): Promise<AuthPayload> {
    const user = await this.validateUser(email, password);
    if (!user) throw new UnauthorizedException('Identifiants invalides');
    const payload: JwtPayload = { email: user.email, sub: user.id };
    return {
      accessToken: this.jwtService.sign(payload),
      email: user.email,
    };
  }

  async validateToken(payload: JwtPayload): Promise<boolean> {
    const user = await this.userRepo.findOne({
      where: { id: payload.sub, email: payload.email },
    });
    return !!user;
  }

  async getUserById(id: number) {
    return this.userRepo.findOne({
      where: { id },
      select: ['id', 'email', 'role'],
    });
  }

  async getUserForAuth(id: number, email: string) {
    return this.userRepo.findOne({
      where: { id, email },
      select: ['id', 'email', 'role', 'prenom', 'nom', 'avatar'],
    });
  }
}
