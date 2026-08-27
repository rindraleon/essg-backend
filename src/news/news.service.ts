import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { PaginatedData } from '../common/interfaces/api-response.interface';
import { buildPaginatedData } from '../common/utils/pagination.util';
import { CreateActualiteDto, UpdateActualiteDto } from './dto/create-news.dto';
import { QueryNewsDto } from './dto/query-news.dto';
import { Actualite } from './entities/news-item.entity';
import { capitalize } from '../common/utils/text.util';
import { buildUniqueSlug, shouldRegenerateSlug } from '../common/utils/slug.util';
import { CacheService } from '../infrastructure/cache/cache.service';
import { CACHE_RESOURCE, CACHE_TTL } from '../infrastructure/cache/cache.constants';

@Injectable()
export class NewsService {
  constructor(
    @InjectRepository(Actualite)
    private readonly repo: Repository<Actualite>,
    private readonly cacheService: CacheService,
  ) {}

  private invalidateCache(): void {
    this.cacheService.invalidateResource(CACHE_RESOURCE.news, CACHE_RESOURCE.dashboard);
  }

  async findAll(paginationDto: QueryNewsDto): Promise<PaginatedData<Actualite>> {
    return this.cacheService.getOrSet(
      this.cacheService.listKey(CACHE_RESOURCE.news, { ...paginationDto }),
      () => this.findAllFromDatabase(paginationDto),
      { ttl: CACHE_TTL.MEDIUM, stampedeProtection: true },
    );
  }

  async search(query: string, paginationDto: QueryNewsDto): Promise<PaginatedData<Actualite>> {
    return this.cacheService.getOrSet(
      this.cacheService.listKey(CACHE_RESOURCE.news, { ...paginationDto, q: query }),
      () => this.searchFromDatabase(query, paginationDto),
      { ttl: CACHE_TTL.SHORT },
    );
  }

  async findOne(id: number): Promise<Actualite> {
    return this.cacheService.getOrSet(
      this.cacheService.itemKey(CACHE_RESOURCE.news, id),
      () => this.findOneFromDatabase(id),
      { ttl: CACHE_TTL.MEDIUM },
    );
  }

  async findBySlug(slug: string): Promise<Actualite> {
    return this.cacheService.getOrSet(
      this.cacheService.slugKey(CACHE_RESOURCE.news, slug),
      () => this.findBySlugFromDatabase(slug),
      { ttl: CACHE_TTL.MEDIUM },
    );
  }

  private async findPaginated(
    where: FindOptionsWhere<Actualite> | FindOptionsWhere<Actualite>[],
    paginationDto: QueryNewsDto,
  ): Promise<PaginatedData<Actualite>> {
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

  private buildWhere(query: string, filters: QueryNewsDto): FindOptionsWhere<Actualite>[] {
    const base: FindOptionsWhere<Actualite> = {};
    if (filters.categorie) base.categorie = filters.categorie;
    if (filters.statut) base.statut = filters.statut === 'publie';
    if (!query.trim()) return [base];
    const term = ILike(`%${query}%`);
    return [
      { ...base, titre: term },
      { ...base, resume: term },
      { ...base, contenu: term },
    ];
  }

  private async findAllFromDatabase(
    paginationDto: QueryNewsDto,
  ): Promise<PaginatedData<Actualite>> {
    return this.findPaginated(this.buildWhere('', paginationDto), paginationDto);
  }

  private async searchFromDatabase(
    query: string,
    paginationDto: QueryNewsDto,
  ): Promise<PaginatedData<Actualite>> {
    return this.findPaginated(this.buildWhere(query, paginationDto), paginationDto);
  }

  private async findOneFromDatabase(id: number): Promise<Actualite> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Actualité non trouvée');
    return item;
  }

  private async findBySlugFromDatabase(slug: string): Promise<Actualite> {
    const item = await this.repo.findOne({ where: { slug } });
    if (!item) throw new NotFoundException('Actualité non trouvée');
    return item;
  }

  async create(dto: CreateActualiteDto): Promise<Actualite> {
    const slug = await buildUniqueSlug(this.repo, dto.titre);
    const item = this.repo.create({
      ...dto,
      slug,
      titre: capitalize(dto.titre),
      categorie: capitalize(dto.categorie),
      auteur: capitalize(dto.auteur),
      resume: dto.resume ? capitalize(dto.resume) : dto.resume,
      contenu: capitalize(dto.contenu),
      enVedette: dto.enVedette ?? false,
      statut: dto.statut ?? false,
      image: dto.image || '/images/hero-campus.jpg',
    });
    const saved = await this.repo.save(item);
    this.invalidateCache();
    return saved;
  }

  async update(id: number, dto: UpdateActualiteDto): Promise<Actualite> {
    const current = await this.findOne(id);
    const updateData: Partial<Actualite> = { ...dto };
    delete (updateData as { slug?: string }).slug;
    if (shouldRegenerateSlug(current.titre, dto.titre, current.slug)) {
      updateData.slug = await buildUniqueSlug(this.repo, dto.titre ?? current.titre, {
        excludeId: id,
      });
    }
    if (dto.titre) {
      updateData.titre = capitalize(dto.titre);
    }
    if (dto.categorie) updateData.categorie = capitalize(dto.categorie);
    if (dto.auteur) updateData.auteur = capitalize(dto.auteur);
    if (dto.resume) updateData.resume = capitalize(dto.resume);
    if (dto.contenu) updateData.contenu = capitalize(dto.contenu);
    if (dto.galerie) updateData.galerie = dto.galerie;
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
