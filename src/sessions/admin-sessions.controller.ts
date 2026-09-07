import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiMessage } from '../common/decorators/api-message.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { FullListQueryDto } from '../common/dto/pagination.dto';
import { PresenceService } from './presence.service';
import { SessionsService } from './sessions.service';
import { toSessionView } from './session.mapper';
import { SessionEventsService } from './session-events.service';

interface AuthUser {
  userId: number;
  sessionId?: string;
}

@ApiTags('Sessions (administration)')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/users')
export class AdminSessionsController {
  constructor(
    private readonly sessionsService: SessionsService,
    private readonly presenceService: PresenceService,
    private readonly events: SessionEventsService,
  ) {}

  @Get('presence')
  @ApiOperation({ summary: 'Présence de tous les utilisateurs, déduite des sessions' })
  @ApiMessage('Présence récupérée')
  async listPresence(@Query() query: FullListQueryDto) {
    return this.presenceService.listPresence(query.page ?? 1, query.limit ?? 100);
  }

  @Get(':userId/sessions')
  @ApiOperation({ summary: "Sessions détaillées d'un utilisateur" })
  @ApiMessage('Sessions récupérées')
  async userSessions(@Param('userId', ParseIntPipe) userId: number) {
    const sessions = await this.sessionsService.findByUser(userId);
    return sessions.map((session) => toSessionView(session));
  }

  @Post(':userId/sessions/:sessionId/revoke')
  @ApiOperation({ summary: "Révoquer une session d'un utilisateur" })
  @ApiMessage('Session révoquée')
  async revoke(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('sessionId') sessionId: string,
    @Body() body: { reason?: string },
    @Request() req: { user: AuthUser },
  ) {
    await this.sessionsService.revoke(sessionId, req.user.userId, body?.reason);
    const session = await this.sessionsService.findById(sessionId);
    await this.events.emitSessionRevoked(userId, sessionId, body?.reason ?? null);
    return session ? toSessionView(session) : null;
  }

  @Post(':userId/sessions/revoke-all')
  @ApiOperation({ summary: "Révoquer toutes les sessions d'un utilisateur" })
  @ApiMessage('Sessions révoquées')
  async revokeAll(
    @Param('userId', ParseIntPipe) userId: number,
    @Request() req: { user: AuthUser },
  ) {
    const revoked = await this.sessionsService.revokeAllForUser(
      userId,
      req.user.userId,
      'admin_revoke_all',
    );
    await this.events.emitSessionRevoked(userId, null, 'admin_revoke_all');
    return { revoked };
  }
}
