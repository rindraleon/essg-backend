import { Session } from './entities/session.entity';
import {
  INACTIVITY_TIMEOUT_MS,
  ONLINE_THRESHOLD_MS,
  SessionStatus,
  UserPresence,
  UserPresenceStatus,
} from './sessions.constants';

export type SessionTimings = Pick<Session, 'revokedAt' | 'expiresAt' | 'lastActivityAt'>;

export function isRevoked(session: Pick<Session, 'revokedAt'>): boolean {
  return session.revokedAt != null;
}

export function isExpired(session: Pick<Session, 'expiresAt'>, now: Date): boolean {
  return session.expiresAt.getTime() <= now.getTime();
}

export function isIdleTimedOut(session: Pick<Session, 'lastActivityAt'>, now: Date): boolean {
  return now.getTime() - session.lastActivityAt.getTime() > INACTIVITY_TIMEOUT_MS;
}

export function isSessionValid(session: SessionTimings, now: Date = new Date()): boolean {
  return !isRevoked(session) && !isExpired(session, now) && !isIdleTimedOut(session, now);
}

export function getSessionStatus(session: SessionTimings, now: Date = new Date()): SessionStatus {
  if (isRevoked(session)) return 'revoked';
  if (isExpired(session, now)) return 'expired';
  if (isIdleTimedOut(session, now)) return 'inactive';
  return 'active';
}

export function computePresence(sessions: SessionTimings[], now: Date = new Date()): UserPresence {
  const valid = sessions.filter((session) => isSessionValid(session, now));
  const online = valid.filter(
    (session) => now.getTime() - session.lastActivityAt.getTime() <= ONLINE_THRESHOLD_MS,
  );

  const lastActivity = valid.reduce<Date | null>((latest, session) => {
    if (!latest || session.lastActivityAt > latest) return session.lastActivityAt;
    return latest;
  }, null);

  let status: UserPresenceStatus = 'offline';
  if (online.length > 0) status = 'online';
  else if (valid.length > 0) status = 'inactive';

  return {
    status,
    activeSessions: online.length,
    validSessions: valid.length,
    totalSessions: sessions.length,
    lastActivityAt: lastActivity ? lastActivity.toISOString() : null,
  };
}
