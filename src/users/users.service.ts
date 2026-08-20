import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { PaginatedData } from '../common/interfaces/api-response.interface';
import { buildPaginatedData } from '../common/utils/pagination.util';
import { MailService } from '../mail/mail.service';
import { CreateUtilisateurDto } from './dto/create-user.dto';
import { UpdateUtilisateurDto } from './dto/update-user.dto';
import { Utilisateur } from './entities/user.entity';
import { PaginationDto } from '../common/dto/pagination.dto';
import { capitalize, toUpperCase } from '../common/utils/text.util';
import { assertEmailIsAvailable } from '../common/utils/duplicate.util';
import { EmailDomainService } from '../common/validators/email-domain.service';

type SanitizedUtilisateur = Omit<Utilisateur, 'motDePasse'>;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(Utilisateur)
    private readonly repo: Repository<Utilisateur>,
    private readonly mailService: MailService,
    private readonly emailDomainService: EmailDomainService,
  ) {}

  private async assertEmailDomainExists(email?: string): Promise<void> {
    if (!email) return;
    const result = await this.emailDomainService.check(email);
    if (result.reason) {
      throw new BadRequestException(result.reason);
    }
  }

  private sanitizeUser(user: Utilisateur): SanitizedUtilisateur {
    const { motDePasse: _motDePasse, ...rest } = user;
    return rest;
  }

  private async findPaginated(
    where: FindOptionsWhere<Utilisateur> | FindOptionsWhere<Utilisateur>[],
    paginationDto: PaginationDto,
  ): Promise<PaginatedData<SanitizedUtilisateur>> {
    const { page = 1, limit = 10, sortBy, sortOrder = 'ASC' } = paginationDto;
    const skip = (page - 1) * limit;

    const [users, total] = await this.repo.findAndCount({
      where,
      order: sortBy ? { [sortBy]: sortOrder } : { id: 'ASC' },
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
    await this.assertEmailDomainExists(dto.email);
    await assertEmailIsAvailable(this.repo, dto.email, 'un autre utilisateur');

    const hashedPassword = await bcrypt.hash(dto.motDePasse, 10);
    const user = this.repo.create({
      ...dto,
      nom: toUpperCase(dto.nom),
      prenom: capitalize(dto.prenom),
      motDePasse: hashedPassword,
    });
    const saved = await this.repo.save(user);

    try {
      await this.mailService.sendWelcomeEmail(saved.email, saved.nom, saved.prenom, dto.motDePasse);
      this.logger.log(`Email de bienvenue envoyé à ${saved.email}`);
    } catch (error) {
      this.logger.error(`Échec de l'envoi de l'email de bienvenue à ${saved.email}`, error);
    }

    return this.sanitizeUser(saved);
  }

  async update(id: number, dto: UpdateUtilisateurDto): Promise<SanitizedUtilisateur> {
    const user = await this.findOne(id);
    await this.assertEmailDomainExists(dto.email);
    await assertEmailIsAvailable(this.repo, dto.email, 'un autre utilisateur', {
      excludeId: id,
    });

    const data: Partial<Utilisateur> = { ...dto };
    if (dto.motDePasse) {
      data.motDePasse = await bcrypt.hash(dto.motDePasse, 10);
    }
    if (dto.nom) {
      data.nom = toUpperCase(dto.nom);
    }
    if (dto.prenom) {
      data.prenom = capitalize(dto.prenom);
    }
    await this.repo.update(id, data);
    return this.findOne(user.id);
  }

  async updateAvatar(id: number, avatarUrl: string): Promise<SanitizedUtilisateur> {
    await this.repo.update(id, { avatar: avatarUrl });
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const user = await this.findOne(id);
    await this.repo.delete(user.id);
  }
}
