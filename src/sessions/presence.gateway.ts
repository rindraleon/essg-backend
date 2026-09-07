import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SessionsService } from './sessions.service';
import { UserPresence } from './sessions.constants';
import type { JwtPayload } from '../auth/jwt-payload.interface';

const ADMIN_ROOM = 'presence:admins';

interface SocketData {
  userId: number;
  role?: string;
  sessionId?: string;
}

interface ServerToClientEvents {
  'auth:error': (payload: { message: string }) => void;
  'presence:changed': (payload: Record<string, unknown>) => void;
  'session:changed': (payload: Record<string, unknown>) => void;
  'session:revoked': (payload: Record<string, unknown>) => void;
}

type PresenceSocket = Socket<
  Record<string, never>,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class PresenceGateway implements OnGatewayConnection {
  private readonly logger = new Logger(PresenceGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly sessionsService: SessionsService,
  ) {}

  async handleConnection(client: PresenceSocket): Promise<void> {
    try {
      const token = (client.handshake.auth as { token?: string })?.token;
      if (!token) throw new Error('missing token');

      const payload = this.jwtService.verify<JwtPayload>(token);
      if (payload.sid) {
        const session = await this.sessionsService.findValidById(payload.sid);
        if (!session) throw new Error('invalid session');
      }

      client.data.userId = payload.sub;
      client.data.role = payload.role;
      client.data.sessionId = payload.sid;
      await client.join(`user:${payload.sub}`);
      if (payload.role === 'admin') await client.join(ADMIN_ROOM);
    } catch {
      client.emit('auth:error', { message: 'Session invalide' });
      client.disconnect(true);
    }
  }

  @SubscribeMessage('presence:ping')
  handlePing(@ConnectedSocket() client: PresenceSocket): void {
    const { sessionId } = client.data;
    if (sessionId) void this.sessionsService.touch(sessionId);
  }

  emitPresenceChanged(userId: number, presence: UserPresence): void {
    this.server?.to(ADMIN_ROOM).emit('presence:changed', { userId, presence });
  }

  emitSessionChanged(event: Record<string, unknown>): void {
    this.server?.to([ADMIN_ROOM, `user:${String(event.userId)}`]).emit('session:changed', event);
  }

  emitSessionRevoked(userId: number, event: Record<string, unknown>): void {
    this.server?.to([ADMIN_ROOM, `user:${userId}`]).emit('session:revoked', event);
  }
}
