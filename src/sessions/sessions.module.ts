import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Session } from './entities/session.entity';
import { Utilisateur } from '../users/entities/user.entity';
import { SessionsService } from './sessions.service';
import { PresenceService } from './presence.service';
import { PresenceGateway } from './presence.gateway';
import { SessionEventsService } from './session-events.service';
import { AdminSessionsController } from './admin-sessions.controller';
import { SessionCleanupService } from './session-cleanup.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Session, Utilisateur]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'essg-default-secret-key-change-in-production'),
      }),
    }),
  ],
  controllers: [AdminSessionsController],
  providers: [
    SessionsService,
    PresenceService,
    PresenceGateway,
    SessionEventsService,
    SessionCleanupService,
  ],
  exports: [SessionsService, PresenceService, SessionEventsService],
})
export class SessionsModule {}
