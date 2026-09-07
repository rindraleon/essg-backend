import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { PaginatedData } from '../common/interfaces/api-response.interface';
import { buildPaginatedData } from '../common/utils/pagination.util';
import { EmailNotificationService } from '../infrastructure/email/email-notification.service';
import { CreateUtilisateurDto } from './dto/create-user.dto';
import { UpdateUtilisateurDto } from './dto/update-user.dto';
import { Utilisateur } from './entities/user.entity';
import { PASSWORD_SALT_ROUNDS } from './users.constants';
import { PaginationDto } from '../common/dto/pagination.dto';
import { capitalizeWords, toUpperCase } from '../common/utils/text.util';
import { assertEmailIsAvailable } from '../common/utils/duplicate.util';
import { EmailGuardService } from '../common/email/email-guard.service';
import { SessionsService } from '../sessions/sessions.service';
import { SessionEventsService } from '../sessions/session-events.service';

type SanitizedUtilisateur = Omit<Utilisateur, 'motDePasse'>;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(Utilisateur)
    private readonly repo: Repository<Utilisateur>,
    private readonly emailNotifications: EmailNotificationService,
    private readonly emailGuard: EmailGuardService,
    private readonly sessionsService: SessionsService,
    private readonly sessionEvents: SessionEventsService,
  ) {}

  private sanitizeUser(user: Utilisateur): SanitizedUtilisateur {
    const sanitized = { ...user } as Partial<Utilisateur>;
    delete sanitized.motDePasse;
    return sanitized as SanitizedUtilisateur;
  }

  private async findPaginated(
    where: FindOptionsWhere<Utilisateur> | FindOptionsWhere<Utilisateur>[],
    paginationDto: PaginationDto,
  ): Promise<PaginatedData<SanitizedUtilisateur>> {
    const { page = 1, limit = 10, sortBy, sortOrder = 'DESC' } = paginationDto;
    const skip = (page - 1) * limit;

    const [users, total] = await this.repo.findAndCount({
      where,
      order: sortBy ? { [sortBy]: sortOrder } : { creeLe: 'DESC' },
      skip,
      take: limit,
    });

    return buildPaginatedData(
      users.map((user) => this.sanitizeUser(user)),
      total,
      page,
      limit,
    );
  }

  async findAll(paginationDto: PaginationDto): Promise<PaginatedData<SanitizedUtilisateur>> {
    return this.findPaginated({}, paginationDto);
  }

  async search(
    query: string,
    paginationDto: PaginationDto,
  ): Promise<PaginatedData<SanitizedUtilisateur>> {
    const where: FindOptionsWhere<Utilisateur>[] = query
      ? [
          { nom: ILike(`%${query}%`) },
          { prenom: ILike(`%${query}%`) },
          { email: ILike(`%${query}%`) },
        ]
      : [{}];
    return this.findPaginated(where, paginationDto);
  }

  async findOne(id: number): Promise<SanitizedUtilisateur> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');
    return this.sanitizeUser(user);
  }

  async findByEmail(email: string): Promise<Utilisateur | null> {
    return this.repo.findOne({ where: { email } });
  }

  async create(dto: CreateUtilisateurDto): Promise<SanitizedUtilisateur> {
    await this.emailGuard.assertUsable(dto.email);
    await assertEmailIsAvailable(this.repo, dto.email, 'un autre utilisateur');

    const hashedPassword = await bcrypt.hash(dto.motDePasse, PASSWORD_SALT_ROUNDS);
    const user = this.repo.create({
      ...dto,
      nom: toUpperCase(dto.nom),
      prenom: capitalizeWords(dto.prenom),
      motDePasse: hashedPassword,
    });
    const saved = await this.repo.save(user);

    await this.emailNotifications.sendUserWelcome({
      email: saved.email,
      nom: saved.nom,
      prenom: saved.prenom,
      motDePasse: dto.motDePasse,
    });

    return this.sanitizeUser(saved);
  }

  async update(id: number, dto: UpdateUtilisateurDto): Promise<SanitizedUtilisateur> {
    const user = await this.findOne(id);
    await this.emailGuard.assertUsable(dto.email);
    await assertEmailIsAvailable(this.repo, dto.email, 'un autre utilisateur', {
      excludeId: id,
    });

    const data: Partial<Utilisateur> = { ...dto };
    if (dto.motDePasse) {
      data.motDePasse = await bcrypt.hash(dto.motDePasse, PASSWORD_SALT_ROUNDS);
    }
    if (dto.nom) {
      data.nom = toUpperCase(dto.nom);
    }
    if (dto.prenom) {
      data.prenom = capitalizeWords(dto.prenom);
    }
    await this.repo.update(id, data);

    if (dto.motDePasse) {
      await this.revokeSessions(id, 'password_changed');
    } else if (dto.estActif === false && user.estActif) {
      await this.revokeSessions(id, 'account_disabled');
    }

    return this.findOne(user.id);
  }

  private async revokeSessions(userId: number, reason: string): Promise<void> {
    const revoked = await this.sessionsService.revokeAllForUser(userId, null, reason);
    if (revoked > 0) {
      await this.sessionEvents.emitSessionRevoked(userId, null, reason);
    }
  }

  async updateAvatar(id: number, avatarUrl: string): Promise<SanitizedUtilisateur> {
    await this.repo.update(id, { avatar: avatarUrl });
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const user = await this.findOne(id);
    await this.revokeSessions(user.id, 'account_deleted');
    await this.repo.delete(user.id);
  }
}
