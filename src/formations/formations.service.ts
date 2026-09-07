import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedData } from '../common/interfaces/api-response.interface';
import { buildPaginatedData } from '../common/utils/pagination.util';
import { ILIKE_ESCAPE, buildIlikeTerm, sanitizeSortField } from '../common/utils/search.util';
import { capitalize, capitalizeArray } from '../common/utils/text.util';
import { buildUniqueSlug, shouldRegenerateSlug } from '../common/utils/slug.util';
import {
  canonicalMentionLabel,
  canonicalTitre,
  findMentionByTitre,
  isTitreInMention,
} from './formation-mentions.constant';
import { CreateFormationDto, UpdateFormationDto } from './dto/create-formation.dto';
import { Formation } from './entities/formation.entity';
import { RessourceHumaine } from '../ressources-humaines/entities/ressource-humaine.entity';
import { CacheService } from '../infrastructure/cache/cache.service';
import { CACHE_RESOURCE, CACHE_TTL } from '../infrastructure/cache/cache.constants';
import { EmailGuardService } from '../common/email/email-guard.service';

const FORMATION_SORT_FIELDS = [
  'id',
  'titre',
  'slug',
  'niveau',
  'duree',
  'credits',
  'enVedette',
  'creeLe',
  'misAJourLe',
] as const;

@Injectable()
export class FormationsService {
  constructor(
    @InjectRepository(Formation)
    private readonly repo: Repository<Formation>,
    @InjectRepository(RessourceHumaine)
    private readonly ressourceRepo: Repository<RessourceHumaine>,
    private readonly cacheService: CacheService,
    private readonly emailGuard: EmailGuardService,
  ) {}

  private invalidateCache(): void {
    this.cacheService.invalidateResource(CACHE_RESOURCE.formations, CACHE_RESOURCE.dashboard);
  }

  async findAll(paginationDto: PaginationDto): Promise<PaginatedData<Formation>> {
    return this.cacheService.getOrSet(
      this.cacheService.listKey(CACHE_RESOURCE.formations, { ...paginationDto }),
      () => this.findAllFromDatabase(paginationDto),
      { ttl: CACHE_TTL.MEDIUM, stampedeProtection: true },
    );
  }

  async search(query: string, paginationDto: PaginationDto): Promise<PaginatedData<Formation>> {
    return this.cacheService.getOrSet(
      this.cacheService.listKey(CACHE_RESOURCE.formations, { ...paginationDto, q: query }),
      () => this.searchFromDatabase(query, paginationDto),
      { ttl: CACHE_TTL.SHORT },
    );
  }

  async findOne(id: number): Promise<Formation> {
    return this.cacheService.getOrSet(
      this.cacheService.itemKey(CACHE_RESOURCE.formations, id),
      () => this.findOneFromDatabase(id),
      { ttl: CACHE_TTL.LONG },
    );
  }

  async findBySlug(slug: string): Promise<Formation> {
    return this.cacheService.getOrSet(
      this.cacheService.slugKey(CACHE_RESOURCE.formations, slug),
      () => this.findBySlugFromDatabase(slug),
      { ttl: CACHE_TTL.LONG },
    );
  }

  private async resolveResponsable(
    responsableId?: number | null,
  ): Promise<{ responsableId: number | null; responsable: string } | null> {
    if (responsableId === undefined) return null;
    if (responsableId === null) return { responsableId: null, responsable: '' };

    const ressource = await this.ressourceRepo.findOne({
      where: { id: responsableId },
      select: ['id', 'nom', 'prenom'],
    });

    if (!ressource) {
      throw new BadRequestException('La ressource humaine sélectionnée est introuvable.');
    }

    return {
      responsableId: ressource.id,
      responsable: `${ressource.nom} ${ressource.prenom}`.trim(),
    };
  }

  private async findAllFromDatabase(
    paginationDto: PaginationDto,
  ): Promise<PaginatedData<Formation>> {
    const { page = 1, limit = 10, sortBy, sortOrder = 'DESC' } = paginationDto;
    const skip = (page - 1) * limit;
    const orderField = sanitizeSortField(sortBy, FORMATION_SORT_FIELDS) ?? 'creeLe';

    const [data, total] = await this.repo.findAndCount({
      order: { [orderField]: sortOrder === 'DESC' ? 'DESC' : 'ASC' },
      skip,
      take: limit,
    });

    return buildPaginatedData(data, total, page, limit);
  }

  private async searchFromDatabase(
    query: string,
    paginationDto: PaginationDto,
  ): Promise<PaginatedData<Formation>> {
    const { page = 1, limit = 10, sortBy, sortOrder = 'DESC' } = paginationDto;
    const skip = (page - 1) * limit;

    if (!query?.trim()) {
      return this.findAll(paginationDto);
    }

    const orderField = sanitizeSortField(sortBy, FORMATION_SORT_FIELDS) ?? 'creeLe';
    const term = buildIlikeTerm(query);

    const [data, total] = await this.repo
      .createQueryBuilder('formation')
      .where(`formation.titre ILIKE :query ${ILIKE_ESCAPE}`, { query: term })
      .orWhere(`formation.description ILIKE :query ${ILIKE_ESCAPE}`, { query: term })
      .orWhere(`formation.mention ILIKE :query ${ILIKE_ESCAPE}`, { query: term })
      .orWhere(`formation.domaine::text ILIKE :query ${ILIKE_ESCAPE}`, { query: term })
      .orderBy(`formation.${orderField}`, sortOrder === 'DESC' ? 'DESC' : 'ASC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return buildPaginatedData(data, total, page, limit);
  }

  private async findOneFromDatabase(id: number): Promise<Formation> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Formation non trouvée');
    return item;
  }

  private async findBySlugFromDatabase(slug: string): Promise<Formation> {
    const item = await this.repo.findOne({ where: { slug } });
    if (!item) throw new NotFoundException('Formation non trouvée');
    return item;
  }

  async create(dto: CreateFormationDto): Promise<Formation> {
    await this.emailGuard.assertUsable(dto.email);
    const { titre, mention } = this.resolveHierarchy(dto.titre, dto.mention);
    const slug = await buildUniqueSlug(this.repo, titre);
    const responsableInfo = await this.resolveResponsable(dto.responsableId);
    const item = this.repo.create({
      ...dto,
      slug,
      mention,
      titre,
      duree: capitalize(dto.duree),
      description: capitalize(dto.description),
      ...(responsableInfo ?? {
        responsable: dto.responsable ? capitalize(dto.responsable) : dto.responsable,
      }),
      domaine: dto.domaine?.length ? capitalizeArray(dto.domaine) : [mention],
      objectifs: capitalizeArray(dto.objectifs),
      debouches: capitalizeArray(dto.debouches),
      conditions: capitalizeArray(dto.conditions),
      competences: capitalizeArray(dto.competences),
      programme: capitalizeArray(dto.programme),
      image: dto.image || '/images/hero-campus.jpg',
    });
    const saved = await this.saveOrConflict(item);
    this.invalidateCache();
    return saved;
  }

  async update(id: number, dto: UpdateFormationDto): Promise<Formation> {
    const current = await this.findOne(id);
    await this.emailGuard.assertUsable(dto.email);
    const updateData: Partial<Formation> = { ...dto };
    delete (updateData as { slug?: string }).slug;

    if (dto.titre !== undefined || dto.mention !== undefined) {
      const { titre, mention } = this.resolveHierarchy(
        dto.titre ?? current.titre,
        dto.mention ?? current.mention,
      );
      updateData.titre = titre;
      updateData.mention = mention;
      if (!dto.domaine) {
        updateData.domaine = [mention];
      }
    }

    if (shouldRegenerateSlug(current.titre, updateData.titre, current.slug)) {
      updateData.slug = await buildUniqueSlug(this.repo, updateData.titre ?? current.titre, {
        excludeId: id,
      });
    }

    if (dto.duree) updateData.duree = capitalize(dto.duree);
    if (dto.description) updateData.description = capitalize(dto.description);
    const responsableInfo = await this.resolveResponsable(dto.responsableId);
    if (responsableInfo) {
      updateData.responsableId = responsableInfo.responsableId;
      updateData.responsable = responsableInfo.responsable;
    } else if (dto.responsable) {
      updateData.responsable = capitalize(dto.responsable);
    }
    if (dto.domaine) updateData.domaine = capitalizeArray(dto.domaine);
    if (dto.objectifs) updateData.objectifs = capitalizeArray(dto.objectifs);
    if (dto.debouches) updateData.debouches = capitalizeArray(dto.debouches);
    if (dto.conditions) updateData.conditions = capitalizeArray(dto.conditions);
    if (dto.competences) updateData.competences = capitalizeArray(dto.competences);
    if (dto.programme) updateData.programme = capitalizeArray(dto.programme);
    try {
      await this.repo.update(id, updateData);
    } catch (error) {
      this.rethrowUnique(error);
    }
    this.invalidateCache();
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.repo.delete(id);
    this.invalidateCache();
  }

  private resolveHierarchy(
    rawTitre: string,
    rawMention?: string | null,
  ): { titre: string; mention: string } {
    const titre = canonicalTitre(rawTitre.trim());
    const deduced = findMentionByTitre(titre);

    if (!rawMention) {
      return { titre, mention: deduced?.label ?? '' };
    }

    const mention = canonicalMentionLabel(rawMention.trim());

    if (deduced && !isTitreInMention(mention, titre)) {
      throw new BadRequestException(
        `Le titre « ${titre} » appartient à la mention « ${deduced.label} » et non à « ${mention} ».`,
      );
    }

    return { titre, mention };
  }

  private async saveOrConflict(item: Formation): Promise<Formation> {
    try {
      return await this.repo.save(item);
    } catch (error) {
      this.rethrowUnique(error);
      throw error;
    }
  }

  private rethrowUnique(error: unknown): void {
    if (error instanceof QueryFailedError) {
      const code = (error.driverError as { code?: string } | undefined)?.code;
      if (code === '23505') {
        throw new ConflictException('Une formation avec ce slug existe déjà.');
      }
    }
  }
}
