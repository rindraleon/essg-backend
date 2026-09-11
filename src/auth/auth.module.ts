import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { SignOptions } from 'jsonwebtoken';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from '../common/guards/jwt.strategy';
import { UsersModule } from '../users/users.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Utilisateur } from '../users/entities/user.entity';
import { SessionsModule } from '../sessions/sessions.module';
import { MailModule } from '../mail/mail.module';
import { ActivityLogsModule } from '../activity-logs/activity-log.module';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { PasswordResetService } from './password-reset.service';
import { PasswordController } from './password.controller';

@Module({
  imports: [
    UsersModule,
    SessionsModule,
    MailModule,
    ActivityLogsModule,
    TypeOrmModule.forFeature([Utilisateur, PasswordResetToken]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const expiresIn = config.get<SignOptions['expiresIn']>('JWT_EXPIRATION') ?? '24h';
        return {
          secret: config.get<string>('JWT_SECRET', 'essg-default-secret-key-change-in-production'),
          signOptions: {
            expiresIn,
          },
        };
      },
    }),
  ],
  controllers: [AuthController, PasswordController],
  providers: [AuthService, JwtStrategy, PasswordResetService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
