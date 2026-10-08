import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedData } from '../common/interfaces/api-response.interface';
import { buildPaginatedData } from '../common/utils/pagination.util';
import { ILIKE_ESCAPE, buildIlikeTerm, sanitizeSortField } from '../common/utils/search.util';
import { capitalize } from '../common/utils/text.util';
import { Formation } from '../formations/entities/formation.entity';
import { CacheService } from '../infrastructure/cache/cache.service';
import { CACHE_RESOURCE } from '../infrastructure/cache/cache.constants';
import { CreateParcoursDto, UpdateParcoursDto } from './dto/create-parcours.dto';
import { QueryParcoursDto } from './dto/query-mention.dto';
import { Mention } from './entities/mention.entity';
import { Parcours } from './entities/parcours.entity';
import { baseSlug, buildScopedUniqueSlug, rethrowUnique } from './mention.utils';

const PARCOURS_SORT_FIELDS = ['id', 'nom', 'slug', 'isActive', 'creeLe', 'misAJourLe'] as const;

export interface ParcoursView {
  id: number;
  nom: string;
  slug: string;
  isActive: boolean;
  mentionId: number;
  mention: { id: number; nom: string; slug: string } | null;
  formationCount: number;
  creeLe: Date;
  misAJourLe: Date;
}

@Injectable()
export class ParcoursService {
  constructor(
    @InjectRepository(Parcours)
    private readonly repo: Repository<Parcours>,
    @InjectRepository(Mention)
    private readonly mentionRepo: Repository<Mention>,
    @InjectRepository(Formation)
    private readonly formationRepo: Repository<Formation>,
    private readonly cacheService: CacheService,
  ) {}

  private invalidateCache(): void {
    this.cacheService.invalidateResource(
      CACHE_RESOURCE.mentions,
      CACHE_RESOURCE.parcours,
      CACHE_RESOURCE.formations,
      CACHE_RESOURCE.dashboard,
    );
  }

  async countFormations(parcoursId: number): Promise<number> {
    return this.formationRepo.count({ where: { parcoursId } });
  }

  private toView(parcours: Parcours, formationCount: number): ParcoursView {
    return {
      id: parcours.id,
      nom: parcours.nom,
      slug: parcours.slug,
      isActive: parcours.isActive,
      mentionId: parcours.mentionId,
      mention: parcours.mention
        ? {
            id: parcours.mention.id,
            nom: parcours.mention.nom,
            slug: parcours.mention.slug,
          }
        : null,
      formationCount,
      creeLe: parcours.creeLe,
      misAJourLe: parcours.misAJourLe,
    };
  }

  async findAll(query: QueryParcoursDto): Promise<PaginatedData<ParcoursView>> {
    const { page = 1, limit = 10, sortBy, sortOrder = 'DESC', q, mentionId } = query;
    const skip = (page - 1) * limit;
    const orderField = sanitizeSortField(sortBy, PARCOURS_SORT_FIELDS) ?? 'nom';

    const qb = this.repo
      .createQueryBuilder('parcours')
      .leftJoinAndSelect('parcours.mention', 'mention');

    if (mentionId !== undefined) {
      qb.where('parcours.mentionId = :mentionId', { mentionId });
    }
    if (q?.trim()) {
      const term = buildIlikeTerm(q);
      qb.andWhere(
        `(parcours.nom ILIKE :q ${ILIKE_ESCAPE} OR parcours.slug ILIKE :q ${ILIKE_ESCAPE})`,
        {
          q: term,
        },
      );
    }

    qb.orderBy(`parcours.${orderField}`, sortOrder === 'ASC' ? 'ASC' : 'DESC')
      .skip(skip)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();
    const counts = await this.countsByParcours(items.map((item) => item.id));
    return buildPaginatedData(
      items.map((item) => this.toView(item, counts.get(item.id) ?? 0)),
      total,
      page,
      limit,
    );
  }

  private async countsByParcours(ids: number[]): Promise<Map<number, number>> {
    if (ids.length === 0) return new Map();
    const rows = await this.formationRepo
      .createQueryBuilder('formation')
      .select('formation.parcoursId', 'parcoursId')
      .addSelect('COUNT(formation.id)::int', 'count')
      .where('formation.parcoursId IN (:...ids)', { ids })
      .groupBy('formation.parcoursId')
      .getRawMany<{ parcoursId: number; count: string }>();
    return new Map(rows.map((row) => [Number(row.parcoursId), Number(row.count)]));
  }

  async findOne(id: number): Promise<ParcoursView> {
    const parcours = await this.repo.findOne({ where: { id }, relations: { mention: true } });
    if (!parcours) throw new NotFoundException('Parcours non trouvé');
    const count = await this.countFormations(id);
    return this.toView(parcours, count);
  }

  private async assertMentionExists(mentionId: number): Promise<Mention> {
    const mention = await this.mentionRepo.findOne({
      where: { id: mentionId },
      select: ['id'],
    });
    if (!mention) {
      throw new BadRequestException('La mention sélectionnée est introuvable.');
    }
    return mention;
  }

  async create(dto: CreateParcoursDto): Promise<ParcoursView> {
    await this.assertMentionExists(dto.mentionId);
    const nom = capitalize(dto.nom.trim());

    const duplicate = await this.repo.findOne({
      where: { mentionId: dto.mentionId, slug: baseSlug(nom) },
    });
    if (duplicate) {
      throw new ConflictException('Un parcours porte déjà ce nom dans cette mention.');
    }

    let saved: Parcours;
    try {
      const slug = await buildScopedUniqueSlug(this.repo, nom, { mentionId: dto.mentionId });
      saved = await this.repo.save(
        this.repo.create({
          nom,
          slug,
          mentionId: dto.mentionId,
          isActive: dto.isActive ?? true,
        }),
      );
    } catch (error) {
      rethrowUnique(error, 'Un parcours porte déjà ce nom dans cette mention.');
      throw error;
    }

    this.invalidateCache();
    return this.findOne(saved.id);
  }

  async update(id: number, dto: UpdateParcoursDto): Promise<ParcoursView> {
    const current = await this.repo.findOne({ where: { id } });
    if (!current) throw new NotFoundException('Parcours non trouvé');

    const movesMention = dto.mentionId !== undefined && dto.mentionId !== current.mentionId;
    if (movesMention) {
      const usage = await this.countFormations(id);
      if (usage > 0) {
        throw new BadRequestException(
          `Impossible de déplacer ce parcours : ${usage} formation(s) l'utilisent déjà. Réaffectez ces formations d'abord.`,
        );
      }
      await this.assertMentionExists(dto.mentionId as number);
    }

    const nextMentionId = movesMention ? (dto.mentionId as number) : current.mentionId;
    const nom = dto.nom ? capitalize(dto.nom.trim()) : current.nom;
    if (nom !== current.nom || movesMention) {
      const duplicate = await this.repo.findOne({
        where: { mentionId: nextMentionId, slug: baseSlug(nom) },
      });
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException('Un parcours porte déjà ce nom dans cette mention.');
      }
    }

    try {
      const patch: Partial<Parcours> = { nom, mentionId: nextMentionId };
      if (movesMention || nom !== current.nom) {
        patch.slug = await buildScopedUniqueSlug(
          this.repo,
          nom,
          { mentionId: nextMentionId },
          {
            excludeId: id,
          },
        );
      }
      if (dto.isActive !== undefined) patch.isActive = dto.isActive;
      await this.repo.update(id, patch);
    } catch (error) {
      rethrowUnique(error, 'Un parcours porte déjà ce nom dans cette mention.');
      throw error;
    }

    this.invalidateCache();
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const current = await this.repo.findOne({ where: { id }, select: ['id', 'nom'] });
    if (!current) throw new NotFoundException('Parcours non trouvé');

    const usage = await this.countFormations(id);
    if (usage > 0) {
      throw new BadRequestException(
        `Ce parcours est utilisé par ${usage} formation(s). Réaffectez ou supprimez ces formations avant de le supprimer.`,
      );
    }

    try {
      await this.repo.delete(id);
    } catch (error) {
      rethrowUnique(error, 'Suppression impossible : des données dépendent de ce parcours.');
      throw error;
    }
    this.invalidateCache();
  }
}
