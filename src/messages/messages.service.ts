import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedData } from '../common/interfaces/api-response.interface';
import { buildPaginatedData } from '../common/utils/pagination.util';
import { ILIKE_ESCAPE, buildIlikeTerm, sanitizeSortField } from '../common/utils/search.util';
import { EmailNotificationService } from '../infrastructure/email/email-notification.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { CreateMessageDto, UpdateMessageDto } from './dto/create-message.dto';
import { QueryMessageDto } from './dto/query-message.dto';
import { ReplyMessageDto } from './dto/reply-message.dto';
import { Message } from './entities/message.entity';
import { capitalize, toUpperCase } from '../common/utils/text.util';
import { normalizePhoneNumber } from '../common/utils/contact.util';
import { EmailGuardService } from '../common/email/email-guard.service';
import { EmailValidationService } from '../common/email/email-validation.service';
import { checkEmailSyntax } from '../common/email/email-format.util';

const MESSAGE_SORT_FIELDS = [
  'id',
  'nom',
  'prenom',
  'email',
  'sujet',
  'lu',
  'creeLe',
  'misAJourLe',
] as const;

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    @InjectRepository(Message)
    private readonly repo: Repository<Message>,
    private readonly emailNotifications: EmailNotificationService,
    private readonly emailGuard: EmailGuardService,
    private readonly emailValidation: EmailValidationService,
  ) {}

  async verifyEmail(email?: string): Promise<{ valide: boolean; raison: string | null }> {
    const syntaxe = checkEmailSyntax(email);
    if (!syntaxe.valid) {
      return { valide: false, raison: syntaxe.reason };
    }

    try {
      const result = await this.emailValidation.validate(email, { probeMailbox: true });
      return { valide: result.valid, raison: result.reason };
    } catch {
      return { valide: true, raison: null };
    }
  }

  private async findFiltered(queryDto: QueryMessageDto = {}): Promise<PaginatedData<Message>> {
    const {
      page = 1,
      limit = 10,
      sortBy,
      sortOrder = 'DESC',
      q,
      sujet,
      lu,
      dateDebut,
      dateFin,
    } = queryDto;
    const qb = this.repo.createQueryBuilder('message');

    if (q?.trim()) {
      const term = buildIlikeTerm(q);
      qb.andWhere(
        `(message.nom ILIKE :term ${ILIKE_ESCAPE}
          OR message.prenom ILIKE :term ${ILIKE_ESCAPE}
          OR message.email ILIKE :term ${ILIKE_ESCAPE}
          OR message.telephone ILIKE :term ${ILIKE_ESCAPE}
          OR message.sujet ILIKE :term ${ILIKE_ESCAPE}
          OR message.message ILIKE :term ${ILIKE_ESCAPE})`,
        { term },
      );
    }

    if (sujet && sujet !== 'all') {
      qb.andWhere('LOWER(message.sujet) = LOWER(:sujet)', { sujet });
    }

    if (typeof lu === 'boolean') {
      qb.andWhere('message.lu = :lu', { lu });
    }

    if (dateDebut) {
      qb.andWhere('message.creeLe >= :dateDebut', { dateDebut });
    }

    if (dateFin) {
      qb.andWhere('message.creeLe <= :dateFin', { dateFin: `${dateFin}T23:59:59.999Z` });
    }

    const orderField = sanitizeSortField(sortBy, MESSAGE_SORT_FIELDS) ?? 'creeLe';
    qb.orderBy(`message.${orderField}`, sortOrder === 'ASC' ? 'ASC' : 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return buildPaginatedData(items, total, page, limit);
  }

  async findAll(queryDto: QueryMessageDto = {}): Promise<PaginatedData<Message>> {
    return this.findFiltered(queryDto);
  }

  async search(query: string, queryDto: QueryMessageDto = {}): Promise<PaginatedData<Message>> {
    return this.findFiltered({ ...queryDto, q: query || queryDto.q });
  }

  async findOne(id: number): Promise<Message> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Message non trouvé');
    return item;
  }

  async create(dto: CreateMessageDto): Promise<Message> {
    await this.emailGuard.assertDeliverable(dto.email);

    const item = this.repo.create({
      ...dto,
      nom: toUpperCase(dto.nom),
      prenom: capitalize(dto.prenom ?? ''),
      telephone: normalizePhoneNumber(dto.telephone) ?? undefined,
      sujet: capitalize(dto.sujet),
      message: capitalize(dto.message),
    });
    const saved = await this.repo.save(item);

    await this.emailNotifications.sendContactReceipt({
      email: saved.email,
      nom: saved.nom,
      prenom: saved.prenom,
      sujet: saved.sujet,
    });

    await this.emailNotifications.sendContactAdminNotification({
      nom: saved.nom,
      prenom: saved.prenom,
      email: saved.email,
      telephone: saved.telephone ?? undefined,
      sujet: saved.sujet,
      message: saved.message,
      date: new Date().toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    });

    return saved;
  }

  async update(id: number, dto: UpdateMessageDto, reader?: AuthUser): Promise<Message> {
    const item = await this.findOne(id);
    if (dto.lu && !item.lu) {
      item.lu = true;
      item.luLe = new Date();
      item.luPar = reader?.email ?? item.luPar;
    } else if (dto.lu === false) {
      item.lu = false;
    }
    return this.repo.save(item);
  }

  async reply(id: number, dto: ReplyMessageDto, author: AuthUser): Promise<Message> {
    const item = await this.findOne(id);
    const sujet = dto.sujet?.trim() || `Re : ${item.sujet}`;

    await this.emailNotifications.sendContactReply({
      to: item.email,
      prenom: item.prenom,
      nom: item.nom,
      sujet,
      message: dto.message,
    });

    item.lu = true;
    item.luLe = item.luLe ?? new Date();
    item.luPar = item.luPar ?? author.email;
    item.reponse = dto.message;
    item.reponseSujet = sujet;
    item.reponduLe = new Date();
    item.reponduPar = author.email;
    return this.repo.save(item);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.repo.delete(id);
  }
}
