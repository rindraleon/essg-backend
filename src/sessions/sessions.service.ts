import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThan, Repository } from 'typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { Session } from './entities/session.entity';
import { REFRESH_TOKEN_TTL_MS, TOUCH_THROTTLE_MS, UserPresence } from './sessions.constants';
import { computePresence, getSessionStatus, isSessionValid } from './session-status.util';

export interface SessionContext {
  ipAddress?: string | null;
  deviceName?: string | null;
  browserName?: string | null;
  osName?: string | null;
}

export interface CreatedSession {
  session: Session;
  refreshToken: string;
}

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    @InjectRepository(Session)
    private readonly repo: Repository<Session>,
  ) {}

  static hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async create(userId: number, context: SessionContext = {}): Promise<CreatedSession> {
    const refreshToken = randomBytes(48).toString('hex');
    const now = new Date();

    const session = this.repo.create({
      userId,
      refreshTokenHash: SessionsService.hashToken(refreshToken),
      expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
      lastActivityAt: now,
      revokedAt: null,
      revokedBy: null,
      revokedReason: null,
      ipAddress: context.ipAddress ?? null,
      deviceName: context.deviceName ?? null,
      browserName: context.browserName ?? null,
      osName: context.osName ?? null,
    });

    return { session: await this.repo.save(session), refreshToken };
  }

  async findById(sessionId: string): Promise<Session | null> {
    return this.repo.findOne({ where: { id: sessionId } });
  }

  async findValidById(sessionId: string, now: Date = new Date()): Promise<Session | null> {
    const session = await this.findById(sessionId);
    if (!session || !isSessionValid(session, now)) return null;
    return session;
  }

  async findByRefreshToken(refreshToken: string): Promise<Session | null> {
    return this.repo.findOne({
      where: { refreshTokenHash: SessionsService.hashToken(refreshToken) },
    });
  }

  async findByUser(userId: number): Promise<Session[]> {
    return this.repo.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async touch(sessionId: string, now: Date = new Date()): Promise<void> {
    const session = await this.findById(sessionId);
    if (!session || !isSessionValid(session, now)) return;
    if (now.getTime() - session.lastActivityAt.getTime() < TOUCH_THROTTLE_MS) return;
    await this.repo.update({ id: sessionId }, { lastActivityAt: now });
  }

  async rotateRefreshToken(session: Session): Promise<string> {
    const refreshToken = randomBytes(48).toString('hex');
    const now = new Date();
    await this.repo.update(
      { id: session.id },
      {
        refreshTokenHash: SessionsService.hashToken(refreshToken),
        lastActivityAt: now,
        expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
      },
    );
    return refreshToken;
  }

  async revoke(sessionId: string, revokedBy: number | null, reason?: string): Promise<boolean> {
    const result = await this.repo.update(
      { id: sessionId, revokedAt: IsNull() },
      { revokedAt: new Date(), revokedBy, revokedReason: reason ?? null },
    );
    return (result.affected ?? 0) > 0;
  }

  async revokeAllForUser(
    userId: number,
    revokedBy: number | null,
    reason?: string,
    except?: string,
  ): Promise<number> {
    const targets = await this.repo.find({
      where: { userId, revokedAt: IsNull() },
      select: ['id'],
    });
    const ids = targets.map((item) => item.id).filter((id) => id !== except);
    if (ids.length === 0) return 0;

    const result = await this.repo.update(
      { id: In(ids) },
      { revokedAt: new Date(), revokedBy, revokedReason: reason ?? null },
    );
    return result.affected ?? 0;
  }

  async getPresence(userId: number, now: Date = new Date()): Promise<UserPresence> {
    return computePresence(await this.findByUser(userId), now);
  }

  async getPresenceForUsers(
    userIds: number[],
    now: Date = new Date(),
  ): Promise<Map<number, UserPresence>> {
    const result = new Map<number, UserPresence>();
    if (userIds.length === 0) return result;

    const sessions = await this.repo.find({ where: { userId: In(userIds) } });
    const grouped = new Map<number, Session[]>();
    for (const session of sessions) {
      const list = grouped.get(session.userId) ?? [];
      list.push(session);
      grouped.set(session.userId, list);
    }
    for (const userId of userIds) {
      result.set(userId, computePresence(grouped.get(userId) ?? [], now));
    }
    return result;
  }

  getStatus(session: Session, now: Date = new Date()) {
    return getSessionStatus(session, now);
  }

  async cleanupExpired(before: Date): Promise<number> {
    const result = await this.repo.delete({ expiresAt: LessThan(before) });
    const removed = result.affected ?? 0;
    if (removed > 0) this.logger.log(`${removed} session(s) expirée(s) purgée(s)`);
    return removed;
  }
}
