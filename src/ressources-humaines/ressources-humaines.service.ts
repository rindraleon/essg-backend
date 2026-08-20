import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedData } from '../common/interfaces/api-response.interface';
import { buildPaginatedData } from '../common/utils/pagination.util';
import {
  CreateRessourceHumaineDto,
  UpdateRessourceHumaineDto,
 ExperienceProfessionnelleDto } from './dto/create-ressource-humaine.dto';
import {
  ExperienceProfessionnelle,
  RessourceHumaine,
} from './entities/ressource-humaine.entity';
import { capitalize, toUpperCase } from '../common/utils/text.util';
import { buildUniqueSlug, shouldRegenerateSlug } from '../common/utils/slug.util';
import {
  assertEmailIsAvailable,
  assertPhoneIsAvailable,
} from '../common/utils/duplicate.util';
import { EmailDomainService } from '../common/validators/email-domain.service';
import { ILIKE_ESCAPE, buildIlikeTerm } from '../common/utils/search.util';


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
    private readonly emailDomainService: EmailDomainService,
  ) {}

  private async assertEmailDomainExists(email?: string): Promise<void> {
    if (!email) return;
    const result = await this.emailDomainService.check(email);
    if (result.reason) {
      throw new BadRequestException(result.reason);
    }
  }


  private async findPaginated(
    where: Record<string, unknown> | Record<string, unknown>[],
    paginationDto: PaginationDto,
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

  async findAll(paginationDto: PaginationDto): Promise<PaginatedData<RessourceHumaine>> {
    return this.findPaginated({ actif: true }, paginationDto);
  }

  async findAllIncludingInactive(
    paginationDto: PaginationDto,
  ): Promise<PaginatedData<RessourceHumaine>> {
    return this.findPaginated({}, paginationDto);
  }

  async search(
    query: string,
    paginationDto: PaginationDto,
  ): Promise<PaginatedData<RessourceHumaine>> {
    const { page = 1, limit = 10, sortBy, sortOrder = 'ASC' } = paginationDto;
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
      .orderBy(sortBy ? `ressource.${sortBy}` : 'ressource.ordre', sortOrder)
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return buildPaginatedData(data, total, page, limit);
  }

  async findOne(id: number): Promise<RessourceHumaine> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Ressource humaine non trouvée');
    return item;
  }

  async findBySlug(slug: string): Promise<RessourceHumaine> {
    const item = await this.repo.findOne({ where: { slug } });
    if (!item) throw new NotFoundException('Ressource humaine non trouvée');
    return item;
  }

  async create(dto: CreateRessourceHumaineDto): Promise<RessourceHumaine> {
    // Email et téléphone identifient une personne : un doublon signale
    // presque toujours une double saisie de la même fiche.
    await this.assertEmailDomainExists(dto.email);
    await assertEmailIsAvailable(this.repo, dto.email, 'une autre ressource humaine');
    await assertPhoneIsAvailable(this.repo, dto.telephone, 'une autre ressource humaine');

    const item = this.repo.create({
      ...dto,
      nom: toUpperCase(dto.nom),
      prenom: capitalize(dto.prenom),
      poste: capitalize(dto.poste),
      description: dto.description ? capitalize(dto.description) : dto.description,
      slug: await buildUniqueSlug(this.repo, `${dto.nom} ${dto.prenom}`),
      actif: dto.actif ?? true,
      ordre: dto.ordre ?? 0,
      photo: dto.photo || '',
      adresse: dto.adresse?.trim() || undefined,
      // Parcours issu du CV : nettoyé avant persistance.
      experiences: normalizeExperiences(dto.experiences) ?? [],
      formations: normalizeList(dto.formations) ?? [],
      diplomes: normalizeList(dto.diplomes) ?? [],
      competences: normalizeList(dto.competences) ?? [],
      langues: normalizeList(dto.langues) ?? [],
    });
    return this.repo.save(item);
  }

  async update(id: number, dto: UpdateRessourceHumaineDto): Promise<RessourceHumaine> {
    const current = await this.findOne(id);
    await this.assertEmailDomainExists(dto.email);
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
      updateData.prenom = capitalize(dto.prenom);
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
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.repo.delete(id);
  }
}
