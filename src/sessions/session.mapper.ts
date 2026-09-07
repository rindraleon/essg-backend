import { Session } from './entities/session.entity';
import { getSessionStatus } from './session-status.util';

export interface SessionView {
  id: string;
  userId: number;
  status: string;
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
  lastSeenAt: string | null;
  revokedAt: string | null;
  revokedBy: number | null;
  ipAddress: string | null;
  deviceName: string | null;
  browserName: string | null;
  osName: string | null;
  isCurrent?: boolean;
}

export function toSessionView(
  session: Session,
  currentSessionId?: string,
  now: Date = new Date(),
): SessionView {
  return {
    id: session.id,
    userId: session.userId,
    status: getSessionStatus(session, now),
    createdAt: session.createdAt.toISOString(),
    lastActivityAt: session.lastActivityAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    lastSeenAt: session.lastActivityAt.toISOString(),
    revokedAt: session.revokedAt ? session.revokedAt.toISOString() : null,
    revokedBy: session.revokedBy,
    ipAddress: session.ipAddress,
    deviceName: session.deviceName,
    browserName: session.browserName,
    osName: session.osName,
    ...(currentSessionId ? { isCurrent: session.id === currentSessionId } : {}),
  };
}
