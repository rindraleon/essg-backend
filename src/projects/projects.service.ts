import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, In, Repository } from 'typeorm';
import { PaginatedData } from '../common/interfaces/api-response.interface';
import { buildPaginatedData } from '../common/utils/pagination.util';
import { CreateProjetDto, UpdateProjetDto, ProjectSourceDto } from './dto/create-project.dto';
import { QueryProjectDto } from './dto/query-project.dto';
import { Projet, ProjectSource } from './entities/project.entity';
import { capitalize, capitalizeArray } from '../common/utils/text.util';
import { buildUniqueSlug, shouldRegenerateSlug } from '../common/utils/slug.util';
import { Partenaire } from '../parteners/entities/partner.entity';
import { CacheService } from '../infrastructure/cache/cache.service';
import { CACHE_RESOURCE, CACHE_TTL } from '../infrastructure/cache/cache.constants';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Projet)
    private readonly repo: Repository<Projet>,
    @InjectRepository(Partenaire)
    private readonly partnerRepo: Repository<Partenaire>,
    private readonly cacheService: CacheService,
  ) {}

  private invalidateCache(): void {
    this.cacheService.invalidateResource(CACHE_RESOURCE.projects, CACHE_RESOURCE.dashboard);
  }

  async findAll(paginationDto: QueryProjectDto): Promise<PaginatedData<Projet>> {
    return this.cacheService.getOrSet(
      this.cacheService.listKey(CACHE_RESOURCE.projects, { ...paginationDto }),
      () => this.findAllFromDatabase(paginationDto),
      { ttl: CACHE_TTL.MEDIUM, stampedeProtection: true },
    );
  }

  async search(query: string, paginationDto: QueryProjectDto): Promise<PaginatedData<Projet>> {
    return this.cacheService.getOrSet(
      this.cacheService.listKey(CACHE_RESOURCE.projects, { ...paginationDto, q: query }),
      () => this.searchFromDatabase(query, paginationDto),
      { ttl: CACHE_TTL.SHORT },
    );
  }

  async findOne(id: number): Promise<Projet> {
    return this.cacheService.getOrSet(
      this.cacheService.itemKey(CACHE_RESOURCE.projects, id),
      () => this.findOneFromDatabase(id),
      { ttl: CACHE_TTL.MEDIUM },
    );
  }

  async findBySlug(slug: string): Promise<Projet> {
    return this.cacheService.getOrSet(
      this.cacheService.slugKey(CACHE_RESOURCE.projects, slug),
      () => this.findBySlugFromDatabase(slug),
      { ttl: CACHE_TTL.MEDIUM },
    );
  }

  private normalizeSources(sources?: ProjectSourceDto[]): ProjectSource[] {
    if (!sources) return [];
    return sources.map((source) => {
      if (!source || typeof source.title !== 'string' || typeof source.url !== 'string') {
        throw new BadRequestException('Chaque source doit avoir un titre et une URL valide.');
      }
      const title = source.title.trim();
      const rawUrl = source.url.trim();
      if (!title || !rawUrl) {
        throw new BadRequestException('Chaque source doit avoir un titre et une URL valide.');
      }
      const withProtocol = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
      let parsed: URL;
      try {
        parsed = new URL(withProtocol);
      } catch {
        throw new BadRequestException(`L'URL « ${rawUrl} » est invalide.`);
      }
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new BadRequestException(`L'URL « ${rawUrl} » doit utiliser http ou https.`);
      }
      return { title, url: parsed.toString() };
    });
  }

  private async resolvePartenaires(
    ids?: number[],
  ): Promise<{ partenaireIds: number[]; partenaires: string[] } | null> {
    if (!ids) return null;
    if (ids.length === 0) return { partenaireIds: [], partenaires: [] };

    const found = await this.partnerRepo.find({
      where: { id: In(ids) },
      select: ['id', 'nom'],
    });

    const byId = new Map(found.map((partner) => [partner.id, partner.nom]));
    const partenaireIds = ids.filter((id) => byId.has(id));

    return {
      partenaireIds,
      partenaires: partenaireIds.map((id) => byId.get(id) as string),
    };
  }

  private async findPaginated(
    where: FindOptionsWhere<Projet> | FindOptionsWhere<Projet>[],
    paginationDto: QueryProjectDto,
  ): Promise<PaginatedData<Projet>> {
    const { page = 1, limit = 10, sortBy, sortOrder = 'DESC' } = paginationDto;
    const skip = (page - 1) * limit;

    const [data, total] = await this.repo.findAndCount({
      where,
      order: sortBy ? { [sortBy]: sortOrder } : { creeLe: 'DESC' },
      skip,
      take: limit,
    });

    return buildPaginatedData(data, total, page, limit);
  }

  private buildWhere(query: string, filters: QueryProjectDto): FindOptionsWhere<Projet>[] {
    const base: FindOptionsWhere<Projet> = {};
    if (filters.type) base.type = filters.type as Projet['type'];
    if (filters.statut) base.statut = filters.statut as Projet['statut'];
    if (!query.trim()) return [base];
    return [
      { ...base, titre: ILike(`%${query}%`) },
      { ...base, description: ILike(`%${query}%`) },
    ];
  }

  private async findAllFromDatabase(
    paginationDto: QueryProjectDto,
  ): Promise<PaginatedData<Projet>> {
    return this.findPaginated(this.buildWhere('', paginationDto), paginationDto);
  }

  private async searchFromDatabase(
    query: string,
    paginationDto: QueryProjectDto,
  ): Promise<PaginatedData<Projet>> {
    return this.findPaginated(this.buildWhere(query, paginationDto), paginationDto);
  }

  private async findOneFromDatabase(id: number): Promise<Projet> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Projet non trouvé');
    return item;
  }

  private async findBySlugFromDatabase(slug: string): Promise<Projet> {
    const item = await this.repo.findOne({ where: { slug } });
    if (!item) throw new NotFoundException('Projet non trouvé');
    return item;
  }

  async create(dto: CreateProjetDto): Promise<Projet> {
    const slug = await buildUniqueSlug(this.repo, dto.titre);
    const resolved = await this.resolvePartenaires(dto.partenaireIds);
    const item = this.repo.create({
      ...dto,
      slug,
      titre: capitalize(dto.titre),
      description: capitalize(dto.description),
      ville: dto.ville ? capitalize(dto.ville) : dto.ville,
      pays: dto.pays ? capitalize(dto.pays) : dto.pays,
      adresse: dto.adresse ? capitalize(dto.adresse) : dto.adresse,
      ...(resolved ?? { partenaires: capitalizeArray(dto.partenaires) }),
      galerie: dto.galerie ?? [],
      sources: this.normalizeSources(dto.sources),
    });
    const saved = await this.repo.save(item);
    this.invalidateCache();
    return saved;
  }

  async update(id: number, dto: UpdateProjetDto): Promise<Projet> {
    const current = await this.findOne(id);
    const updateData: Partial<Projet> = { ...dto };
    delete (updateData as { slug?: string }).slug;
    if (shouldRegenerateSlug(current.titre, dto.titre, current.slug)) {
      updateData.slug = await buildUniqueSlug(this.repo, dto.titre ?? current.titre, {
        excludeId: id,
      });
    }
    if (dto.titre) updateData.titre = capitalize(dto.titre);
    if (dto.description) updateData.description = capitalize(dto.description);
    if (dto.ville) updateData.ville = capitalize(dto.ville);
    if (dto.pays) updateData.pays = capitalize(dto.pays);
    if (dto.adresse) updateData.adresse = capitalize(dto.adresse);
    const resolved = await this.resolvePartenaires(dto.partenaireIds);
    if (resolved) {
      updateData.partenaireIds = resolved.partenaireIds;
      updateData.partenaires = resolved.partenaires;
    } else if (dto.partenaires) {
      updateData.partenaires = capitalizeArray(dto.partenaires);
    }
    if (dto.galerie) updateData.galerie = dto.galerie;
    if (dto.sources) updateData.sources = this.normalizeSources(dto.sources);
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
