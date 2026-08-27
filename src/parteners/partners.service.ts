import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { PaginatedData } from '../common/interfaces/api-response.interface';
import { buildPaginatedData } from '../common/utils/pagination.util';
import { CreatePartenaireDto, UpdatePartenaireDto } from './dto/create-partner.dto';
import { QueryPartnerDto } from './dto/query-partner.dto';
import { Partenaire } from './entities/partner.entity';
import { capitalize, toUpperCase } from '../common/utils/text.util';
import { buildUniqueSlug, shouldRegenerateSlug } from '../common/utils/slug.util';
import { CacheService } from '../infrastructure/cache/cache.service';
import { CACHE_RESOURCE, CACHE_TTL } from '../infrastructure/cache/cache.constants';

@Injectable()
export class PartnersService {
  constructor(
    @InjectRepository(Partenaire)
    private readonly repo: Repository<Partenaire>,
    private readonly cacheService: CacheService,
  ) {}

  private invalidateCache(): void {
    this.cacheService.invalidateResource(
      CACHE_RESOURCE.partners,
      CACHE_RESOURCE.projects,
      CACHE_RESOURCE.dashboard,
    );
  }

  async findAll(paginationDto: QueryPartnerDto): Promise<PaginatedData<Partenaire>> {
    return this.cacheService.getOrSet(
      this.cacheService.listKey(CACHE_RESOURCE.partners, { ...paginationDto }),
      () => this.findAllFromDatabase(paginationDto),
      { ttl: CACHE_TTL.LONG, stampedeProtection: true },
    );
  }

  async search(query: string, paginationDto: QueryPartnerDto): Promise<PaginatedData<Partenaire>> {
    return this.cacheService.getOrSet(
      this.cacheService.listKey(CACHE_RESOURCE.partners, { ...paginationDto, q: query }),
      () => this.searchFromDatabase(query, paginationDto),
      { ttl: CACHE_TTL.SHORT },
    );
  }

  async findOne(id: number): Promise<Partenaire> {
    return this.cacheService.getOrSet(
      this.cacheService.itemKey(CACHE_RESOURCE.partners, id),
      () => this.findOneFromDatabase(id),
      { ttl: CACHE_TTL.LONG },
    );
  }

  async findBySlug(slug: string): Promise<Partenaire> {
    return this.cacheService.getOrSet(
      this.cacheService.slugKey(CACHE_RESOURCE.partners, slug),
      () => this.findBySlugFromDatabase(slug),
      { ttl: CACHE_TTL.LONG },
    );
  }

  async findByName(nom: string): Promise<Partenaire> {
    return this.cacheService.getOrSet(
      this.cacheService.viewKey(CACHE_RESOURCE.partners, 'name', nom),
      () => this.findByNameFromDatabase(nom),
      { ttl: CACHE_TTL.LONG },
    );
  }

  private async findPaginated(
    where: FindOptionsWhere<Partenaire> | FindOptionsWhere<Partenaire>[],
    paginationDto: QueryPartnerDto,
  ): Promise<PaginatedData<Partenaire>> {
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

  private buildWhere(query: string, filters: QueryPartnerDto): FindOptionsWhere<Partenaire>[] {
    const base: FindOptionsWhere<Partenaire> = {};
    if (filters.type) base.type = filters.type as Partenaire['type'];
    if (!query.trim()) return [base];
    return [
      { ...base, nom: ILike(`%${query}%`) },
      { ...base, description: ILike(`%${query}%`) },
      { ...base, secteur: ILike(`%${query}%`) },
    ];
  }

  private async findAllFromDatabase(
    paginationDto: QueryPartnerDto,
  ): Promise<PaginatedData<Partenaire>> {
    return this.findPaginated(this.buildWhere('', paginationDto), paginationDto);
  }

  private async searchFromDatabase(
    query: string,
    paginationDto: QueryPartnerDto,
  ): Promise<PaginatedData<Partenaire>> {
    return this.findPaginated(this.buildWhere(query, paginationDto), paginationDto);
  }

  private async findOneFromDatabase(id: number): Promise<Partenaire> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Partenaire non trouvé');
    return item;
  }

  private async findBySlugFromDatabase(slug: string): Promise<Partenaire> {
    const item = await this.repo.findOne({ where: { slug } });
    if (!item) throw new NotFoundException('Partenaire non trouvé');
    return item;
  }

  private async findByNameFromDatabase(nom: string): Promise<Partenaire> {
    const item = await this.repo.findOne({ where: { nom } });
    if (!item) throw new NotFoundException('Partenaire non trouvé');
    return item;
  }

  async create(dto: CreatePartenaireDto): Promise<Partenaire> {
    const slug = await buildUniqueSlug(this.repo, dto.nom);
    const item = this.repo.create({
      ...dto,
      nom: toUpperCase(dto.nom),
      secteur: dto.secteur ? capitalize(dto.secteur) : dto.secteur,
      description: capitalize(dto.description),
      slug,
      dateDebut: new Date(dto.dateDebut),
    });
    const saved = await this.repo.save(item);
    this.invalidateCache();
    return saved;
  }

  async update(id: number, dto: UpdatePartenaireDto): Promise<Partenaire> {
    const current = await this.findOne(id);

    const updateData: Partial<Partenaire> = {
      ...dto,
      nom: dto.nom ? toUpperCase(dto.nom) : current.nom,
      secteur: dto.secteur !== undefined ? capitalize(dto.secteur) : current.secteur,
      description: dto.description ? capitalize(dto.description) : current.description,
      dateDebut: dto.dateDebut ? new Date(dto.dateDebut) : current.dateDebut,
    };
    delete (updateData as { slug?: string }).slug;

    if (shouldRegenerateSlug(current.nom, dto.nom, current.slug)) {
      updateData.slug = await buildUniqueSlug(this.repo, dto.nom ?? current.nom, {
        excludeId: id,
      });
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
