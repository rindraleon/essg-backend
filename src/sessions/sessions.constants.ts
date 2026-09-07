export const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

export const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const ACCESS_TOKEN_TTL = '15m';

export const TOUCH_THROTTLE_MS = 60 * 1000;

export const SESSION_ERRORS = {
  invalidRefresh: 'Session invalide ou expirée',
  accountDisabled: 'Compte désactivé',
} as const;

export type SessionStatus = 'active' | 'inactive' | 'expired' | 'revoked';

export type UserPresenceStatus = 'online' | 'inactive' | 'offline';

export interface UserPresence {
  status: UserPresenceStatus;
  activeSessions: number;
  validSessions: number;
  totalSessions: number;
  lastActivityAt: string | null;
}
