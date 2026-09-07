import { Injectable } from '@nestjs/common';
import { PresenceGateway } from './presence.gateway';
import { SessionsService } from './sessions.service';
import { SessionStatus } from './sessions.constants';

export type SessionEventAction =
  | 'session.created'
  | 'session.touched'
  | 'session.expired'
  | 'session.revoked'
  | 'session.logout'
  | 'sessions.revokedAll';

@Injectable()
export class SessionEventsService {
  constructor(
    private readonly gateway: PresenceGateway,
    private readonly sessionsService: SessionsService,
  ) {}

  async emitSessionChanged(
    userId: number,
    sessionId: string | null,
    action: SessionEventAction,
    sessionStatus: SessionStatus | null = null,
  ): Promise<void> {
    const presence = await this.sessionsService.getPresence(userId);
    this.gateway.emitSessionChanged({
      userId,
      sessionId,
      action,
      sessionStatus,
      presence,
      at: new Date().toISOString(),
    });
    this.gateway.emitPresenceChanged(userId, presence);
  }

  async emitSessionRevoked(
    userId: number,
    sessionId: string | null,
    reason: string | null,
  ): Promise<void> {
    const presence = await this.sessionsService.getPresence(userId);
    this.gateway.emitSessionRevoked(userId, {
      userId,
      sessionId,
      action: sessionId ? 'session.revoked' : 'sessions.revokedAll',
      reason,
      at: new Date().toISOString(),
    });
    this.gateway.emitPresenceChanged(userId, presence);
  }
}
