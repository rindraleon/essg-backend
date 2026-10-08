import { BadRequestException } from '@nestjs/common';
import { Formation } from './entities/formation.entity';
import { CreateFormationDto } from './dto/create-formation.dto';
import { FormationsService } from './formations.service';
import { firstCallArg, makeQueryBuilder, makeRepo, type RepoMock } from '../mentions/spec-helpers';

const MENTION = {
  id: 3,
  nom: 'Géomatique et applications',
  slug: 'geomatique-et-applications',
  domaine: 'Géomatique',
};

const PARCOURS = {
  id: 8,
  mentionId: 3,
  nom: 'Géomatique et Agriculture Durable',
  slug: 'geomatique-et-agriculture-durable',
  isActive: true,
  mention: MENTION,
};

function makeCache() {
  return {
    getOrSet: <T>(_key: string, loader: () => Promise<T>): Promise<T> => loader(),
    listKey: (r: string): string => `${r}:list`,
    itemKey: (r: string, id: number): string => `${r}:item:${String(id)}`,
    slugKey: (r: string, s: string): string => `${r}:slug:${s}`,
    viewKey: (r: string, s: string): string => `${r}:${s}`,
    invalidateResource: jest.fn(),
  };
}

describe('FormationsService — hiérarchie Domaine → Mention → Parcours → Formation', () => {
  let service: FormationsService;
  let formationRepo: RepoMock;
  let parcoursRepo: RepoMock;

  const baseDto: CreateFormationDto = {
    parcoursId: 8,
    titre: 'Géomatique et agriculture durable — promotion 2026',
    niveau: 'Licence',
    duree: '3 ans',
    description: 'Formation de référence en géomatique appliquée.',
    objectifs: ['Analyser des données spatiales'],
    debouches: ['Géomaticien'],
    credits: 180,
  };

  beforeEach(() => {
    formationRepo = makeRepo();
    parcoursRepo = makeRepo({
      findOne: jest.fn(() => Promise.resolve({ ...PARCOURS })),
    });
    const mentionRepo = makeRepo();

    formationRepo.findOne.mockImplementation((opts: { where?: { id?: number } }) =>
      Promise.resolve(
        opts?.where?.id !== undefined
          ? ({
              id: 77,
              slug: 'geomatique-et-agriculture-durable-promotion-2026',
              titre: baseDto.titre,
              mention: MENTION.nom,
              domaine: [MENTION.nom],
              parcoursId: 8,
            } as unknown as Formation)
          : null,
      ),
    );

    service = new FormationsService(
      formationRepo as unknown as never,
      makeRepo() as unknown as never,
      parcoursRepo as unknown as never,
      mentionRepo as unknown as never,
      makeCache() as unknown as never,
      { assertUsable: jest.fn() } as unknown as never,
    );
  });

  it('recalcule les miroirs mention/domaine depuis le parcours sélectionné', async () => {
    await service.create(baseDto);
    expect(formationRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mention: MENTION.nom,
        domaine: [MENTION.nom],
        parcoursId: PARCOURS.id,
      }),
    );
  });

  it('refuse un parcours inexistant (400)', async () => {
    parcoursRepo.findOne.mockResolvedValue(null);
    await expect(service.create({ ...baseDto, parcoursId: 999 })).rejects.toThrow(
      'Le parcours sélectionné est introuvable.',
    );
    expect(formationRepo.save).not.toHaveBeenCalled();
  });

  it('refuse un parcours désactivé (400)', async () => {
    parcoursRepo.findOne.mockResolvedValue({ ...PARCOURS, isActive: false });
    await expect(service.create(baseDto)).rejects.toThrow(BadRequestException);
  });

  it('refuse une mention incohérente avec le parcours choisi (400)', async () => {
    await expect(
      service.create({ ...baseDto, mention: 'Géomatique et management' }),
    ).rejects.toThrow(/déduite du parcours/);
    expect(formationRepo.save).not.toHaveBeenCalled();
  });

  it('accepte une mention explicite cohérente avec le parcours', async () => {
    await expect(service.create({ ...baseDto, mention: MENTION.nom })).resolves.toBeDefined();
  });

  it('ne prend jamais le DTO comme source : le miroir vient du parcours', async () => {
    const other = { ...PARCOURS, mention: { ...MENTION, nom: 'Géomatique et management' } };
    parcoursRepo.findOne.mockResolvedValue(other);
    await service.create(baseDto);
    expect(formationRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ mention: 'Géomatique et management' }),
    );
  });

  it('lit les formations avec le parcours et la mention imbriqués', async () => {
    await service.findAll({ page: 1, limit: 10 } as never);
    expect(formationRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ relations: { parcours: { mention: true } } }),
    );
  });

  it('recherche aussi sur le nom du parcours et de la mention', async () => {
    const qb = makeQueryBuilder();
    formationRepo.createQueryBuilder.mockReturnValue(qb);
    await service.search('agriculture', { page: 1, limit: 10 });
    const whereSql = firstCallArg<string>(qb.where);
    expect(whereSql).toContain('formation.titre ILIKE');
    const orClauses = (qb.orWhere.mock?.calls ?? []) as unknown as string[][];
    expect(orClauses.map((call) => call[0]).join(' ')).toContain('parcours.nom ILIKE');
  });

  it('titre non fourni : le titre dérive du nom du parcours (une seule information métier)', async () => {
    const dto = { ...baseDto };
    delete dto.titre;
    await service.create(dto);
    expect(formationRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ titre: PARCOURS.nom }),
    );
  });

  it('en update, régénère les miroirs quand le parcours change', async () => {
    const moved = {
      ...PARCOURS,
      id: 9,
      nom: 'Géomatique et Bonne Gouvernance',
      mention: {
        ...MENTION,
        id: 4,
        nom: 'Géomatique et management',
        slug: 'geomatique-et-management',
      },
    };
    parcoursRepo.findOne.mockResolvedValue(moved);
    await service.update(77, { parcoursId: 9 });
    const payload = firstCallArg<Partial<Formation>>(formationRepo.update, 1);
    expect(payload).toMatchObject({
      parcoursId: 9,
      mention: 'Géomatique et management',
      domaine: ['Géomatique et management'],
      // Formation = Parcours : sans titre dans la requête, le nom du nouveau
      // parcours devient le titre — jamais deux valeurs divergentes.
      titre: 'Géomatique et Bonne Gouvernance',
    });
  });

  it('en update, ignore toute tentative d’agir sur slug/mention/domaine directement', async () => {
    await service.update(77, { description: 'Autre description' });
    const payload = firstCallArg<Partial<Formation>>(formationRepo.update, 1);
    expect(payload.slug).toBeUndefined();
    expect(payload.mention).toBeUndefined();
    expect(payload.domaine).toBeUndefined();
  });
});
