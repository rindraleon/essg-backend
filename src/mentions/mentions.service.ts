import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { PaginatedData } from '../common/interfaces/api-response.interface';
import { buildPaginatedData } from '../common/utils/pagination.util';
import { buildUniqueSlug, shouldRegenerateSlug } from '../common/utils/slug.util';
import { ILIKE_ESCAPE, buildIlikeTerm, sanitizeSortField } from '../common/utils/search.util';
import { capitalize } from '../common/utils/text.util';
import { Formation } from '../formations/entities/formation.entity';
import { CacheService } from '../infrastructure/cache/cache.service';
import { CACHE_RESOURCE, CACHE_TTL } from '../infrastructure/cache/cache.constants';
import { CreateMentionDto } from './dto/create-mention.dto';
import { UpdateMentionDto } from './dto/update-mention.dto';
import { QueryMentionDto } from './dto/query-mention.dto';
import { Mention } from './entities/mention.entity';
import { Parcours } from './entities/parcours.entity';
import {
  assertNoDuplicateNames,
  baseSlug,
  buildScopedUniqueSlug,
  rethrowUnique,
} from './mention.utils';

const MENTION_SORT_FIELDS = [
  'id',
  'nom',
  'slug',
  'domaine',
  'isActive',
  'creeLe',
  'misAJourLe',
] as const;

export interface ParcoursFormationView {
  id: number;
  titre: string;
  slug: string;
  niveau: string;
  enVedette: boolean;
}

export interface MentionParcoursView {
  id: number;
  nom: string;
  slug: string;
  isActive: boolean;
  formationCount: number;
  mentionId: number;
  creeLe: Date;
  misAJourLe: Date;
  formations?: ParcoursFormationView[];
}

export interface MentionView {
  id: number;
  nom: string;
  slug: string;
  domaine: string | null;
  description: string | null;
  isActive: boolean;
  parcoursCount: number;
  creeLe: Date;
  misAJourLe: Date;
  parcours?: MentionParcoursView[];
}

@Injectable()
export class MentionsService {
  constructor(
    @InjectRepository(Mention)
    private readonly repo: Repository<Mention>,
    @InjectRepository(Parcours)
    private readonly parcoursRepo: Repository<Parcours>,
    @InjectRepository(Formation)
    private readonly formationRepo: Repository<Formation>,
    private readonly dataSource: DataSource,
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

  async findAll(query: QueryMentionDto): Promise<PaginatedData<MentionView>> {
    return this.cacheService.getOrSet(
      this.cacheService.listKey(CACHE_RESOURCE.mentions, { ...query }),
      () => this.findAllFromDatabase(query),
      { ttl: CACHE_TTL.MEDIUM, stampedeProtection: true },
    );
  }

  private async findAllFromDatabase(query: QueryMentionDto): Promise<PaginatedData<MentionView>> {
    const { page = 1, limit = 10, sortBy, sortOrder = 'DESC', q, isActive, domaine } = query;
    const skip = (page - 1) * limit;
    const orderField = sanitizeSortField(sortBy, MENTION_SORT_FIELDS) ?? 'creeLe';

    const qb = this.repo.createQueryBuilder('mention');

    if (q?.trim()) {
      const term = buildIlikeTerm(q);
      qb.where(
        `(mention.nom ILIKE :q ${ILIKE_ESCAPE}
          OR mention.slug ILIKE :q ${ILIKE_ESCAPE}
          OR COALESCE(mention.description, '') ILIKE :q ${ILIKE_ESCAPE})`,
        { q: term },
      );
    }
    if (isActive === 'true' || isActive === 'false') {
      qb.andWhere('mention.isActive = :isActive', { isActive: isActive === 'true' });
    }
    if (domaine?.trim()) {
      qb.andWhere('LOWER(mention.domaine) = LOWER(:domaine)', { domaine: domaine.trim() });
    }

    qb.orderBy(`mention.${orderField}`, sortOrder === 'ASC' ? 'ASC' : 'DESC')
      .skip(skip)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();
    const views = await this.attachParcoursCounts(items, query.withParcours === 'true');
    return buildPaginatedData(views, total, page, limit);
  }

  private async attachParcoursCounts(
    mentions: Mention[],
    withParcours: boolean,
  ): Promise<MentionView[]> {
    if (mentions.length === 0) return [];
    const ids = mentions.map((m) => m.id);

    const counts = withParcours
      ? []
      : await this.parcoursRepo
          .createQueryBuilder('parcours')
          .select('parcours.mentionId', 'mentionId')
          .addSelect('COUNT(parcours.id)::int', 'count')
          .where('parcours.mentionId IN (:...ids)', { ids })
          .groupBy('parcours.mentionId')
          .getRawMany<{ mentionId: number; count: string }>();
    const countMap = new Map(counts.map((row) => [Number(row.mentionId), Number(row.count)]));

    const parcoursByMention = withParcours
      ? await this.parcoursRepo.find({
          where: { mentionId: In(ids) },
          order: { nom: 'ASC' },
        })
      : [];
    const formationCounts = withParcours
      ? await this.countFormationsByParcours(parcoursByMention.map((p) => p.id))
      : new Map<number, number>();
    const parcoursByMentionId = new Map<number, MentionParcoursView[]>();
    for (const parcours of parcoursByMention) {
      const list = parcoursByMentionId.get(parcours.mentionId) ?? [];
      list.push(this.toParcoursView(parcours, formationCounts.get(parcours.id) ?? 0));
      parcoursByMentionId.set(parcours.mentionId, list);
    }

    return mentions.map((mention) => ({
      ...mention,
      parcoursCount: withParcours
        ? (parcoursByMentionId.get(mention.id)?.length ?? 0)
        : (countMap.get(mention.id) ?? 0),
      parcours: withParcours ? parcoursByMentionId.get(mention.id) : undefined,
    }));
  }

  private toParcoursView(parcours: Parcours, formationCount: number): MentionParcoursView {
    return {
      id: parcours.id,
      nom: parcours.nom,
      slug: parcours.slug,
      isActive: parcours.isActive,
      formationCount,
      mentionId: parcours.mentionId,
      creeLe: parcours.creeLe,
      misAJourLe: parcours.misAJourLe,
    };
  }

  private async countFormationsByParcours(parcoursIds: number[]): Promise<Map<number, number>> {
    if (parcoursIds.length === 0) return new Map();
    const rows = await this.formationRepo
      .createQueryBuilder('formation')
      .select('formation.parcoursId', 'parcoursId')
      .addSelect('COUNT(formation.id)::int', 'count')
      .where('formation.parcoursId IN (:...ids)', { ids: parcoursIds })
      .groupBy('formation.parcoursId')
      .getRawMany<{ parcoursId: number; count: string }>();
    return new Map(rows.map((row) => [Number(row.parcoursId), Number(row.count)]));
  }

  /** Détail complet : mention + parcours (+ formations rattachées). */
  async findOne(id: number, options: { withFormations?: boolean } = {}): Promise<MentionView> {
    return this.cacheService.getOrSet(
      this.cacheService.viewKey(CACHE_RESOURCE.mentions, 'detail', id),
      () => this.findOneFromDatabase(id, options),
      { ttl: CACHE_TTL.LONG },
    );
  }

  private async findOneFromDatabase(
    id: number,
    options: { withFormations?: boolean },
  ): Promise<MentionView> {
    const mention = await this.repo.findOne({
      where: { id },
      relations: { parcours: true },
      order: { parcours: { nom: 'ASC' } },
    });
    if (!mention) throw new NotFoundException('Mention non trouvée');

    const parcours = mention.parcours ?? [];
    const formationCounts = await this.countFormationsByParcours(parcours.map((p) => p.id));

    let formationsByParcours = new Map<number, ParcoursFormationView[]>();
    if (options.withFormations && parcours.length > 0) {
      const formations = await this.formationRepo.find({
        where: { parcoursId: In(parcours.map((p) => p.id)) },
        select: ['id', 'titre', 'slug', 'niveau', 'enVedette', 'parcoursId'],
        order: { titre: 'ASC' },
      });
      formationsByParcours = new Map<number, ParcoursFormationView[]>();
      for (const formation of formations) {
        const key = formation.parcoursId ?? -1;
        const list = formationsByParcours.get(key) ?? [];
        list.push({
          id: formation.id,
          titre: formation.titre,
          slug: formation.slug,
          niveau: formation.niveau,
          enVedette: formation.enVedette,
        });
        formationsByParcours.set(key, list);
      }
    }

    return {
      ...mention,
      parcoursCount: parcours.length,
      parcours: parcours.map((item) => ({
        ...this.toParcoursView(item, formationCounts.get(item.id) ?? 0),
        formations: options.withFormations ? formationsByParcours.get(item.id) : undefined,
      })),
    };
  }

  /** Options des listes déroulantes : mentions actives uniquement. */
  async findActiveOptions(): Promise<Pick<Mention, 'id' | 'nom' | 'slug' | 'domaine'>[]> {
    return this.cacheService.getOrSet(
      this.cacheService.viewKey(CACHE_RESOURCE.mentions, 'options'),
      () =>
        this.repo.find({
          where: { isActive: true },
          select: ['id', 'nom', 'slug', 'domaine'],
          order: { nom: 'ASC' },
        }),
      { ttl: CACHE_TTL.LONG, stampedeProtection: true },
    );
  }

  /** Domaines distincts des mentions actives (dropdown dépendant du formulaire). */
  async findDistinctDomaines(): Promise<string[]> {
    const rows = await this.repo
      .createQueryBuilder('mention')
      .select('DISTINCT mention.domaine', 'domaine')
      .where('mention.isActive = true')
      .andWhere('mention.domaine IS NOT NULL')
      .orderBy('mention.domaine', 'ASC')
      .getRawMany<{ domaine: string }>();
    return rows.map((row) => row.domaine).filter(Boolean);
  }

  async findParcoursByMention(mentionId: number): Promise<MentionParcoursView[]> {
    const mention = await this.repo.findOne({ where: { id: mentionId }, select: ['id'] });
    if (!mention) throw new NotFoundException('Mention non trouvée');

    const parcours = await this.parcoursRepo.find({
      where: { mentionId },
      order: { nom: 'ASC' },
    });
    const counts = await this.countFormationsByParcours(parcours.map((p) => p.id));
    return parcours.map((item) => this.toParcoursView(item, counts.get(item.id) ?? 0));
  }

  /**
   * Création atomique : la mention et ses parcours sont enregistrés dans une
   * même transaction. Si un parcours échoue, tout est annulé.
   */
  async create(dto: CreateMentionDto): Promise<MentionView> {
    const nom = capitalize(dto.nom.trim());
    const normalizedSlug = baseSlug(nom);
    const existing = await this.repo.findOne({ where: { slug: normalizedSlug } });
    if (existing) {
      throw new ConflictException('Une mention portant ce nom existe déjà.');
    }
    assertNoDuplicateNames(dto.parcours, 'nom de parcours');

    let created: Mention;
    try {
      created = await this.dataSource.transaction(async (manager) => {
        const mentions = manager.getRepository(Mention);
        const parcoursRepo = manager.getRepository(Parcours);

        const slug = await buildUniqueSlug(mentions, nom);
        const mention = await mentions.save(
          mentions.create({
            nom,
            slug,
            domaine: dto.domaine ? capitalize(dto.domaine) : null,
            description: dto.description?.trim() || null,
            isActive: dto.isActive ?? true,
          }),
        );

        const rows: Parcours[] = [];
        for (const item of dto.parcours) {
          const parcoursNom = capitalize(item.nom.trim());
          const parcoursSlug = await buildScopedUniqueSlug(parcoursRepo, parcoursNom, {
            mentionId: mention.id,
          });
          rows.push(
            parcoursRepo.create({ nom: parcoursNom, slug: parcoursSlug, mentionId: mention.id }),
          );
        }
        await parcoursRepo.save(rows);
        return mention;
      });
    } catch (error) {
      rethrowUnique(error, 'Une mention portant ce nom existe déjà.');
      throw error;
    }

    this.invalidateCache();
    return this.findOneFromDatabase(created.id, {});
  }

  async update(id: number, dto: UpdateMentionDto): Promise<MentionView> {
    const current = await this.repo.findOne({ where: { id } });
    if (!current) throw new NotFoundException('Mention non trouvée');

    const nextNom = dto.nom ? capitalize(dto.nom.trim()) : undefined;
    if (nextNom && nextNom !== current.nom) {
      const conflict = await this.repo.findOne({ where: { slug: baseSlug(nextNom) } });
      if (conflict && conflict.id !== id) {
        throw new ConflictException('Une mention portant ce nom existe déjà.');
      }
    }
    if (dto.parcours) {
      assertNoDuplicateNames(dto.parcours, 'nom de parcours');
      await this.assertParcoursDeletable(id, dto.parcours);
    }

    try {
      await this.dataSource.transaction(async (manager) => {
        const mentions = manager.getRepository(Mention);

        const payload: Partial<Mention> = {};
        if (nextNom) {
          payload.nom = nextNom;
          if (shouldRegenerateSlug(current.nom, nextNom, current.slug)) {
            payload.slug = await buildUniqueSlug(mentions, nextNom, { excludeId: id });
          }
        }
        if (dto.domaine !== undefined)
          payload.domaine = dto.domaine ? capitalize(dto.domaine) : null;
        if (dto.description !== undefined) payload.description = dto.description?.trim() || null;
        if (dto.isActive !== undefined) payload.isActive = dto.isActive;
        if (Object.keys(payload).length > 0) await mentions.update(id, payload);

        if (dto.parcours) {
          await this.syncParcours(manager, id, dto.parcours);
        }
      });
    } catch (error) {
      rethrowUnique(error, 'Une mention portant ce nom existe déjà.');
      throw error;
    }

    this.invalidateCache();
    return this.findOneFromDatabase(id, {});
  }

  /** Refuse la suppression implicite d'un parcours utilisé par des formations. */
  private async assertParcoursDeletable(
    mentionId: number,
    requested: { id?: number; nom: string }[],
  ): Promise<void> {
    const existing = await this.parcoursRepo.find({ where: { mentionId }, select: ['id', 'nom'] });
    const requestedIds = new Set(
      requested.map((item) => item.id).filter((value): value is number => value !== undefined),
    );
    const foreignIds = requested
      .map((item) => item.id)
      .filter((value): value is number => value !== undefined)
      .filter((value) => !existing.some((row) => row.id === value));
    if (foreignIds.length > 0) {
      throw new BadRequestException(
        'Un parcours sélectionné est inexistant ou appartient à une autre mention.',
      );
    }

    const toDelete = existing.filter((row) => !requestedIds.has(row.id));
    if (toDelete.length === 0) return;
    const counts = await this.countFormationsByParcours(toDelete.map((row) => row.id));
    const blocker = toDelete.find((row) => (counts.get(row.id) ?? 0) > 0);
    if (blocker) {
      throw new BadRequestException(
        `Impossible de supprimer le parcours « ${blocker.nom} » : il est utilisé par ${counts.get(
          blocker.id,
        )} formation(s). Réaffectez ou supprimez ces formations d'abord.`,
      );
    }
  }

  private async syncParcours(
    manager: DataSource['manager'],
    mentionId: number,
    requested: { id?: number; nom: string }[],
  ): Promise<void> {
    const parcoursRepo = manager.getRepository(Parcours);
    const existing = await parcoursRepo.find({ where: { mentionId } });
    const byId = new Map(existing.map((row) => [row.id, row]));
    const keptIds = new Set<number>();

    for (const item of requested) {
      const nom = capitalize(item.nom.trim());
      if (item.id !== undefined) {
        keptIds.add(item.id);
        const current = byId.get(item.id);
        if (!current) continue;
        const next: Partial<Parcours> = { nom };
        if (shouldRegenerateSlug(current.nom, nom, current.slug)) {
          next.slug = await buildScopedUniqueSlug(
            parcoursRepo,
            nom,
            { mentionId },
            {
              excludeId: item.id,
            },
          );
        }
        await parcoursRepo.update(item.id, next);
      } else {
        const slug = await buildScopedUniqueSlug(parcoursRepo, nom, { mentionId });
        await parcoursRepo.save(parcoursRepo.create({ nom, slug, mentionId }));
      }
    }

    const toDelete = existing.filter((row) => !keptIds.has(row.id));
    if (toDelete.length > 0) {
      await parcoursRepo.delete(toDelete.map((row) => row.id));
    }
  }

  /**
   * Suppression protégée :
   * - jamais de suppression silencieuse des formations : blocage explicite ;
   * - les parcours ne sont supprimés avec la mention que sur demande explicite
   *   (`cascade=true`) et seulement s'ils n'ont aucune formation.
   */
  async remove(id: number, cascade = false): Promise<void> {
    const mention = await this.repo.findOne({ where: { id }, relations: { parcours: true } });
    if (!mention) throw new NotFoundException('Mention non trouvée');

    const parcoursIds = (mention.parcours ?? []).map((row) => row.id);
    if (parcoursIds.length > 0) {
      const counts = await this.countFormationsByParcours(parcoursIds);
      const totalFormations = [...counts.values()].reduce((sum, value) => sum + value, 0);
      if (totalFormations > 0) {
        throw new BadRequestException(
          `Impossible de supprimer la mention « ${mention.nom} » : ${totalFormations} formation(s) lui sont rattachées via ses parcours. Supprimez ou réaffectez ces formations d'abord.`,
        );
      }
      if (!cascade) {
        throw new BadRequestException(
          `La mention « ${mention.nom} » contient encore ${parcoursIds.length} parcours. Supprimez-les, ou confirmez la suppression des parcours associés.`,
        );
      }
    }

    try {
      await this.dataSource.transaction(async (manager) => {
        if (parcoursIds.length > 0) {
          await manager.getRepository(Parcours).delete({ mentionId: id });
        }
        await manager.getRepository(Mention).delete(id);
      });
    } catch (error) {
      rethrowUnique(error, 'Suppression impossible : des données dépendent de cette mention.');
      throw error;
    }
    this.invalidateCache();
  }
}
