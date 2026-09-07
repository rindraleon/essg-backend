import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedData } from '../common/interfaces/api-response.interface';
import { buildPaginatedData } from '../common/utils/pagination.util';
import {
  CreateRessourceHumaineDto,
  UpdateRessourceHumaineDto,
  ExperienceProfessionnelleDto,
} from './dto/create-ressource-humaine.dto';
import { QueryRessourceHumaineDto } from './dto/query-ressource-humaine.dto';
import { ExperienceProfessionnelle, RessourceHumaine } from './entities/ressource-humaine.entity';
import { capitalize, capitalizeWords, toUpperCase } from '../common/utils/text.util';
import { buildUniqueSlug, shouldRegenerateSlug } from '../common/utils/slug.util';
import { assertEmailIsAvailable, assertPhoneIsAvailable } from '../common/utils/duplicate.util';
import { EmailGuardService } from '../common/email/email-guard.service';
import { ILIKE_ESCAPE, buildIlikeTerm } from '../common/utils/search.util';
import { CacheService } from '../infrastructure/cache/cache.service';
import { CACHE_RESOURCE, CACHE_TTL } from '../infrastructure/cache/cache.constants';

function normalizeList(values?: string[]): string[] | undefined {
  if (!values) return undefined;
  const seen = new Set<string>();
  return values
    .map((value) => value.trim())
    .filter((value) => {
      if (!value) return false;
      const key = value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normalizeExperiences(
  values?: ExperienceProfessionnelleDto[],
): ExperienceProfessionnelle[] | undefined {
  if (!values) return undefined;
  return values
    .filter((item) => item?.poste?.trim())
    .map((item) => ({
      poste: capitalize(item.poste.trim()),
      organisation: item.organisation?.trim() || undefined,
      periode: item.periode?.trim() || undefined,
    }));
}

@Injectable()
export class RessourcesHumainesService {
  constructor(
    @InjectRepository(RessourceHumaine)
    private readonly repo: Repository<RessourceHumaine>,
    private readonly emailGuard: EmailGuardService,
    private readonly cacheService: CacheService,
  ) {}

  private invalidateCache(): void {
    this.cacheService.invalidateResource(
      CACHE_RESOURCE.ressourcesHumaines,
      CACHE_RESOURCE.dashboard,
    );
  }

  async findAll(paginationDto: QueryRessourceHumaineDto): Promise<PaginatedData<RessourceHumaine>> {
    return this.cacheService.getOrSet(
      this.cacheService.listKey(CACHE_RESOURCE.ressourcesHumaines, { ...paginationDto }),
      () => this.findAllFromDatabase(paginationDto),
      { ttl: CACHE_TTL.LONG },
    );
  }

  async search(
    query: string,
    paginationDto: QueryRessourceHumaineDto,
  ): Promise<PaginatedData<RessourceHumaine>> {
    return this.cacheService.getOrSet(
      this.cacheService.listKey(CACHE_RESOURCE.ressourcesHumaines, { ...paginationDto, q: query }),
      () => this.searchFromDatabase(query, paginationDto),
      { ttl: CACHE_TTL.SHORT },
    );
  }

  async findOne(id: number): Promise<RessourceHumaine> {
    return this.cacheService.getOrSet(
      this.cacheService.itemKey(CACHE_RESOURCE.ressourcesHumaines, id),
      () => this.findOneFromDatabase(id),
      { ttl: CACHE_TTL.LONG },
    );
  }

  async findBySlug(slug: string): Promise<RessourceHumaine> {
    return this.cacheService.getOrSet(
      this.cacheService.slugKey(CACHE_RESOURCE.ressourcesHumaines, slug),
      () => this.findBySlugFromDatabase(slug),
      { ttl: CACHE_TTL.LONG },
    );
  }

  async findAllIncludingInactive(
    paginationDto: QueryRessourceHumaineDto,
  ): Promise<PaginatedData<RessourceHumaine>> {
    return this.cacheService.getOrSet(
      this.cacheService.viewKey(CACHE_RESOURCE.ressourcesHumaines, 'list-all', {
        ...paginationDto,
      }),
      () => this.findAllIncludingInactiveFromDatabase(paginationDto),
      { ttl: CACHE_TTL.LONG },
    );
  }

  private async findPaginated(
    where: Record<string, unknown> | Record<string, unknown>[],
    paginationDto: QueryRessourceHumaineDto,
    defaultOrder: Record<string, 'ASC' | 'DESC'> = { ordre: 'DESC', id: 'DESC' },
  ): Promise<PaginatedData<RessourceHumaine>> {
    const { page = 1, limit = 10, sortBy, sortOrder = 'DESC' } = paginationDto;
    const skip = (page - 1) * limit;

    const [data, total] = await this.repo.findAndCount({
      where,
      order: sortBy ? { [sortBy]: sortOrder } : defaultOrder,
      skip,
      take: limit,
    });

    return buildPaginatedData(data, total, page, limit);
  }

  private async findAllFromDatabase(
    paginationDto: QueryRessourceHumaineDto,
  ): Promise<PaginatedData<RessourceHumaine>> {
    return this.findPaginated(
      { actif: true, ...(paginationDto.poste ? { poste: paginationDto.poste } : {}) },
      paginationDto,
    );
  }

  private async findAllIncludingInactiveFromDatabase(
    paginationDto: QueryRessourceHumaineDto,
  ): Promise<PaginatedData<RessourceHumaine>> {
    return this.findPaginated({}, paginationDto);
  }

  private async searchFromDatabase(
    query: string,
    paginationDto: QueryRessourceHumaineDto,
  ): Promise<PaginatedData<RessourceHumaine>> {
    const { page = 1, limit = 10, sortBy, sortOrder = 'DESC' } = paginationDto;
    const skip = (page - 1) * limit;

    if (!query) {
      return this.findAll(paginationDto);
    }

    const [data, total] = await this.repo
      .createQueryBuilder('ressource')
      .where('ressource.actif = :actif', { actif: true })
      .andWhere(
        `(ressource.nom ILIKE :search ${ILIKE_ESCAPE}
          OR ressource.prenom ILIKE :search ${ILIKE_ESCAPE}
          OR ressource.poste ILIKE :search ${ILIKE_ESCAPE})`,
        { search: buildIlikeTerm(query) },
      )
      .andWhere(paginationDto.poste ? 'ressource.poste = :poste' : '1=1', {
        poste: paginationDto.poste,
      })
      .orderBy(sortBy ? `ressource.${sortBy}` : 'ressource.creeLe', sortOrder)
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return buildPaginatedData(data, total, page, limit);
  }

  private async findOneFromDatabase(id: number): Promise<RessourceHumaine> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Ressource humaine non trouvée');
    return item;
  }

  private async findBySlugFromDatabase(slug: string): Promise<RessourceHumaine> {
    const item = await this.repo.findOne({ where: { slug } });
    if (!item) throw new NotFoundException('Ressource humaine non trouvée');
    return item;
  }

  async create(dto: CreateRessourceHumaineDto): Promise<RessourceHumaine> {
    await this.emailGuard.assertUsable(dto.email);
    await assertEmailIsAvailable(this.repo, dto.email, 'une autre ressource humaine');
    await assertPhoneIsAvailable(this.repo, dto.telephone, 'une autre ressource humaine');

    const item = this.repo.create({
      ...dto,
      nom: toUpperCase(dto.nom),
      prenom: capitalizeWords(dto.prenom),
      poste: capitalize(dto.poste),
      description: dto.description ? capitalize(dto.description) : dto.description,
      slug: await buildUniqueSlug(this.repo, `${dto.nom} ${dto.prenom}`),
      actif: dto.actif ?? true,
      ordre: dto.ordre ?? 0,
      photo: dto.photo || '',
      adresse: dto.adresse?.trim() || undefined,
      experiences: normalizeExperiences(dto.experiences) ?? [],
      formations: normalizeList(dto.formations) ?? [],
      diplomes: normalizeList(dto.diplomes) ?? [],
      competences: normalizeList(dto.competences) ?? [],
      langues: normalizeList(dto.langues) ?? [],
    });
    const saved = await this.repo.save(item);
    this.invalidateCache();
    return saved;
  }

  async update(id: number, dto: UpdateRessourceHumaineDto): Promise<RessourceHumaine> {
    const current = await this.findOne(id);
    await this.emailGuard.assertUsable(dto.email);
    await assertEmailIsAvailable(this.repo, dto.email, 'une autre ressource humaine', {
      excludeId: id,
    });
    await assertPhoneIsAvailable(this.repo, dto.telephone, 'une autre ressource humaine', {
      excludeId: id,
    });

    const updateData: Partial<RessourceHumaine> = { ...dto };
    if (dto.nom) {
      updateData.nom = toUpperCase(dto.nom);
    }
    if (dto.prenom) {
      updateData.prenom = capitalizeWords(dto.prenom);
    }
    if (dto.poste) {
      updateData.poste = capitalize(dto.poste);
    }
    if (dto.description) {
      updateData.description = capitalize(dto.description);
    }
    if (dto.experiences) updateData.experiences = normalizeExperiences(dto.experiences);
    if (dto.formations) updateData.formations = normalizeList(dto.formations);
    if (dto.diplomes) updateData.diplomes = normalizeList(dto.diplomes);
    if (dto.competences) updateData.competences = normalizeList(dto.competences);
    if (dto.langues) updateData.langues = normalizeList(dto.langues);
    const nextFullName = `${dto.nom ?? current.nom} ${dto.prenom ?? current.prenom}`;
    const currentFullName = `${current.nom} ${current.prenom}`;
    if (shouldRegenerateSlug(currentFullName, nextFullName, current.slug)) {
      updateData.slug = await buildUniqueSlug(this.repo, nextFullName, { excludeId: id });
    }
    await this.repo.update(id, updateData);
    this.invalidateCache();
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.repo.delete(id);
    this.invalidateCache();
  }
}
