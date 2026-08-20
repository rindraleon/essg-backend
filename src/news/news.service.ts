import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedData } from '../common/interfaces/api-response.interface';
import { buildPaginatedData } from '../common/utils/pagination.util';
import { CreateActualiteDto, UpdateActualiteDto } from './dto/create-news.dto';
import { Actualite } from './entities/news-item.entity';
import { capitalize } from '../common/utils/text.util';
import { buildUniqueSlug, shouldRegenerateSlug } from '../common/utils/slug.util';

@Injectable()
export class NewsService {
  constructor(
    @InjectRepository(Actualite)
    private readonly repo: Repository<Actualite>,
  ) {}

  private async findPaginated(
    where: FindOptionsWhere<Actualite> | FindOptionsWhere<Actualite>[],
    paginationDto: PaginationDto,
  ): Promise<PaginatedData<Actualite>> {
    const { page = 1, limit = 10, sortBy, sortOrder = 'ASC' } = paginationDto;
    const skip = (page - 1) * limit;

    const [data, total] = await this.repo.findAndCount({
      where,
      order: sortBy ? { [sortBy]: sortOrder } : { date: 'DESC' },
      skip,
      take: limit,
    });

    return buildPaginatedData(data, total, page, limit);
  }

  async findAll(paginationDto: PaginationDto): Promise<PaginatedData<Actualite>> {
    return this.findPaginated({}, paginationDto);
  }

  async search(query: string, paginationDto: PaginationDto): Promise<PaginatedData<Actualite>> {
    const where: FindOptionsWhere<Actualite>[] = query
      ? [{ titre: ILike(`%${query}%`) }, { contenu: ILike(`%${query}%`) }]
      : [{}];
    return this.findPaginated(where, paginationDto);
  }

  async findOne(id: number): Promise<Actualite> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Actualité non trouvée');
    return item;
  }

  async findBySlug(slug: string): Promise<Actualite> {
    const item = await this.repo.findOne({ where: { slug } });
    if (!item) throw new NotFoundException('Actualité non trouvée');
    return item;
  }

  async create(dto: CreateActualiteDto): Promise<Actualite> {
    // Slug toujours dérivé du titre, jamais de la saisie utilisateur.
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
    return this.repo.save(item);
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
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.repo.delete(id);
  }
}
