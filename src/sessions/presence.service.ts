import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Utilisateur } from '../users/entities/user.entity';
import { SessionsService } from './sessions.service';
import { UserPresence } from './sessions.constants';

export interface PresenceUser {
  id: number;
  email: string;
  prenom: string;
  nom: string;
  presence: UserPresence;
}

export interface PresenceList {
  items: PresenceUser[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

@Injectable()
export class PresenceService {
  constructor(
    @InjectRepository(Utilisateur)
    private readonly userRepo: Repository<Utilisateur>,
    private readonly sessionsService: SessionsService,
  ) {}

  async isUserOnline(userId: number): Promise<boolean> {
    const presence = await this.sessionsService.getPresence(userId);
    return presence.status === 'online';
  }

  async getUserPresence(userId: number): Promise<UserPresence> {
    return this.sessionsService.getPresence(userId);
  }

  async listPresence(page = 1, limit = 100): Promise<PresenceList> {
    const [users, total] = await this.userRepo.findAndCount({
      select: ['id', 'email', 'prenom', 'nom'],
      order: { creeLe: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const presenceMap = await this.sessionsService.getPresenceForUsers(
      users.map((user) => user.id),
    );

    return {
      items: users.map((user) => ({
        id: user.id,
        email: user.email,
        prenom: user.prenom,
        nom: user.nom,
        presence: presenceMap.get(user.id) as UserPresence,
      })),
      meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }
}
