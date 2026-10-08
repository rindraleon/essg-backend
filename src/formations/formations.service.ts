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
import { Mention } from '../mentions/entities/mention.entity';
import { Parcours } from '../mentions/entities/parcours.entity';
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

/** Relations chargées en lecture : parcours + mention déduite du parcours. */
const FORMATION_RELATIONS = { parcours: { mention: true } } as const;

@Injectable()
export class FormationsService {
  constructor(
    @InjectRepository(Formation)
    private readonly repo: Repository<Formation>,
    @InjectRepository(RessourceHumaine)
    private readonly ressourceRepo: Repository<RessourceHumaine>,
    @InjectRepository(Parcours)
    private readonly parcoursRepo: Repository<Parcours>,
    @InjectRepository(Mention)
    private readonly mentionRepo: Repository<Mention>,
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

  private async resolveParcours(parcoursId: number): Promise<Parcours> {
    const parcours = await this.parcoursRepo.findOne({
      where: { id: parcoursId },
      relations: { mention: true },
    });
    if (!parcours || !parcours.mention) {
      throw new BadRequestException('Le parcours sélectionné est introuvable.');
    }
    if (!parcours.isActive) {
      throw new BadRequestException(
        `Le parcours « ${parcours.nom} » est désactivé ; sélectionnez un parcours actif.`,
      );
    }
    return parcours;
  }

  private assertMentionMatchesParcours(mention: string | undefined, parcours: Parcours): void {
    if (!mention?.trim()) return;
    const derived = (parcours.mention as Mention).nom.trim().toLowerCase();
    if (mention.trim().toLowerCase() !== derived) {
      throw new BadRequestException(
        `La mention est déduite du parcours sélectionné « ${parcours.nom} » (mention : « ${derived} ») ; elle ne peut pas être définie indépendamment.`,
      );
    }
  }

  private mirrorsFromParcours(parcours: Parcours): { mention: string; domaine: string[] } {
    const mention = (parcours.mention as Mention).nom;
    return { mention, domaine: [mention] };
  }

  private async findAllFromDatabase(
    paginationDto: PaginationDto,
  ): Promise<PaginatedData<Formation>> {
    const { page = 1, limit = 10, sortBy, sortOrder = 'DESC' } = paginationDto;
    const skip = (page - 1) * limit;
    const orderField = sanitizeSortField(sortBy, FORMATION_SORT_FIELDS) ?? 'creeLe';

    const [data, total] = await this.repo.findAndCount({
      relations: FORMATION_RELATIONS,
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

    const qb = this.repo
      .createQueryBuilder('formation')
      .leftJoinAndSelect('formation.parcours', 'parcours')
      .leftJoinAndSelect('parcours.mention', 'mention')
      .where(`formation.titre ILIKE :query ${ILIKE_ESCAPE}`, { query: term })
      .orWhere(`formation.description ILIKE :query ${ILIKE_ESCAPE}`, { query: term })
      .orWhere(`formation.mention ILIKE :query ${ILIKE_ESCAPE}`, { query: term })
      .orWhere(`parcours.nom ILIKE :query ${ILIKE_ESCAPE}`, { query: term })
      .orWhere(`mention.nom ILIKE :query ${ILIKE_ESCAPE}`, { query: term })
      .orderBy(`formation.${orderField}`, sortOrder === 'DESC' ? 'DESC' : 'ASC')
      .skip(skip)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return buildPaginatedData(data, total, page, limit);
  }

  private async findOneFromDatabase(id: number): Promise<Formation> {
    const item = await this.repo.findOne({ where: { id }, relations: FORMATION_RELATIONS });
    if (!item) throw new NotFoundException('Formation non trouvée');
    return item;
  }

  private async findBySlugFromDatabase(slug: string): Promise<Formation> {
    const item = await this.repo.findOne({ where: { slug }, relations: FORMATION_RELATIONS });
    if (!item) throw new NotFoundException('Formation non trouvée');
    return item;
  }

  async create(dto: CreateFormationDto): Promise<Formation> {
    await this.emailGuard.assertUsable(dto.email);
    const parcours = await this.resolveParcours(dto.parcoursId);
    this.assertMentionMatchesParcours(dto.mention, parcours);
    const mirrors = this.mirrorsFromParcours(parcours);
    // « Formation = Parcours » : sans titre fourni, celui du parcours s'applique.
    const titre = (dto.titre?.trim() || parcours.nom).trim();
    const slug = await buildUniqueSlug(this.repo, titre);
    const responsableInfo = await this.resolveResponsable(dto.responsableId);
    const item = this.repo.create({
      ...dto,
      slug,
      titre,
      mention: mirrors.mention,
      domaine: [mirrors.mention],
      parcoursId: parcours.id,
      duree: capitalize(dto.duree),
      description: capitalize(dto.description),
      ...(responsableInfo ?? {
        responsable: dto.responsable ? capitalize(dto.responsable) : dto.responsable,
      }),
      objectifs: capitalizeArray(dto.objectifs),
      debouches: capitalizeArray(dto.debouches),
      conditions: capitalizeArray(dto.conditions),
      competences: capitalizeArray(dto.competences),
      programme: capitalizeArray(dto.programme),
      image: dto.image || '/images/hero-campus.jpg',
    });
    const saved = await this.saveOrConflict(item);
    this.invalidateCache();
    return this.findOneFromDatabase(saved.id);
  }

  async update(id: number, dto: UpdateFormationDto): Promise<Formation> {
    const current = await this.findOne(id);
    await this.emailGuard.assertUsable(dto.email);
    const updateData: Partial<Formation> = { ...dto };
    delete (updateData as { slug?: string }).slug;
    delete (updateData as { mention?: string }).mention;
    delete (updateData as { domaine?: string[] }).domaine;

    if (dto.parcoursId !== undefined) {
      const parcours = await this.resolveParcours(dto.parcoursId);
      const mirrors = this.mirrorsFromParcours(parcours);
      updateData.parcoursId = parcours.id;
      updateData.mention = mirrors.mention;
      updateData.domaine = mirrors.domaine;
      // Changement de parcours sans titre explicite : le titre suit le nouveau
      // parcours (une seule information métier, jamais de valeur divergente).
      updateData.titre = (dto.titre?.trim() || parcours.nom).trim();
    }

    await this.updateSlug(id, current, updateData);
    this.capitalizeUpdateFields(dto, updateData);
    await this.applyResponsableUpdate(dto, updateData);
    try {
      await this.repo.update(id, updateData);
    } catch (error) {
      console.warn(
        'Échec dans update — poursuite en mode dégradé',
        error instanceof Error ? error.message : error,
      );
      this.rethrowUnique(error);
    }
    this.invalidateCache();
    return this.findOne(id);
  }

  private async updateSlug(
    id: number,
    current: Formation,
    updateData: Partial<Formation>,
  ): Promise<void> {
    if (!updateData.titre) return;
    if (!shouldRegenerateSlug(current.titre, updateData.titre, current.slug)) return;
    updateData.slug = await buildUniqueSlug(this.repo, updateData.titre, {
      excludeId: id,
    });
  }

  private capitalizeUpdateFields(dto: UpdateFormationDto, updateData: Partial<Formation>): void {
    if (dto.duree) updateData.duree = capitalize(dto.duree);
    if (dto.description) updateData.description = capitalize(dto.description);
    if (dto.objectifs) updateData.objectifs = capitalizeArray(dto.objectifs);
    if (dto.debouches) updateData.debouches = capitalizeArray(dto.debouches);
    if (dto.conditions) updateData.conditions = capitalizeArray(dto.conditions);
    if (dto.competences) updateData.competences = capitalizeArray(dto.competences);
    if (dto.programme) updateData.programme = capitalizeArray(dto.programme);
  }

  private async applyResponsableUpdate(
    dto: UpdateFormationDto,
    updateData: Partial<Formation>,
  ): Promise<void> {
    const responsableInfo = await this.resolveResponsable(dto.responsableId);
    if (responsableInfo) {
      updateData.responsableId = responsableInfo.responsableId;
      updateData.responsable = responsableInfo.responsable;
    } else if (dto.responsable) {
      updateData.responsable = capitalize(dto.responsable);
    }
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.repo.delete(id);
    this.invalidateCache();
  }

  /**
   * Ancien référentiel des mentions (déprécié) : renvoie désormais les
   * mentions réelles enregistrées en base (utilisé par les clients publics
   * et l'endpoint de compatibilité `GET /formations/mentions`).
   */
  async findMentionLabels(): Promise<Pick<Mention, 'id' | 'nom' | 'slug' | 'domaine'>[]> {
    return this.mentionRepo.find({
      where: { isActive: true },
      select: ['id', 'nom', 'slug', 'domaine'],
      order: { nom: 'ASC' },
    });
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
