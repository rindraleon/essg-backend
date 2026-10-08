import { BadRequestException, ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateMentionDto } from './dto/create-mention.dto';
import { Mention } from './entities/mention.entity';
import { Parcours } from './entities/parcours.entity';
import { MentionsService } from './mentions.service';
import {
  firstCallArg,
  makeCacheService,
  makeQueryBuilder,
  makeRepo,
  type RepoMock,
} from './spec-helpers';

const FIXTURE_MENTION: Mention = {
  id: 10,
  nom: 'Géomatique et applications',
  slug: 'geomatique-et-applications',
  domaine: 'Géomatique',
  description: null,
  isActive: true,
  parcours: [],
  creeLe: new Date('2026-01-01'),
  misAJourLe: new Date('2026-01-01'),
};

const FIXTURE_PARCOURS: Parcours = {
  id: 20,
  mentionId: 10,
  nom: 'Géomatique et Agriculture Durable',
  slug: 'geomatique-et-agriculture-durable',
  isActive: true,
  creeLe: new Date('2026-01-01'),
  misAJourLe: new Date('2026-01-01'),
};

function createDto(partial: Partial<CreateMentionDto> = {}): CreateMentionDto {
  return {
    nom: 'Géomatique et applications',
    domaine: 'Géomatique',
    description: 'Mention historique de l’ESSG',
    isActive: true,
    parcours: [{ nom: 'Géomatique et Agriculture Durable' }],
    ...partial,
  } as CreateMentionDto;
}

describe('MentionsService', () => {
  let service: MentionsService;
  let mentionRepo: RepoMock;
  let parcoursRepo: RepoMock;
  let formationRepo: RepoMock;
  let cacheService: ReturnType<typeof makeCacheService>;
  let dataSource: { transaction: jest.Mock };

  beforeEach(() => {
    mentionRepo = makeRepo();
    parcoursRepo = makeRepo();
    formationRepo = makeRepo();
    cacheService = makeCacheService();

    // Le manager transactionnel renvoie les mêmes mocks.
    const manager = {
      getRepository: (entity: unknown) => {
        if (entity === Mention) return mentionRepo;
        if (entity === Parcours) return parcoursRepo;
        return formationRepo;
      },
    };
    dataSource = {
      transaction: jest.fn((cb: (m: unknown) => Promise<unknown>) => cb(manager)),
    };

    service = new MentionsService(
      mentionRepo as unknown as never,
      parcoursRepo as unknown as never,
      formationRepo as unknown as never,
      dataSource as unknown as DataSource,
      cacheService as unknown as never,
    );
  });

  /** findOne par id → détail complet ; findOne par slug → pas de conflit. */
  function stubDetailLookup() {
    mentionRepo.findOne.mockImplementation((opts: { where?: { id?: number } }) =>
      Promise.resolve(
        opts?.where?.id !== undefined ? { ...FIXTURE_MENTION, parcours: [FIXTURE_PARCOURS] } : null,
      ),
    );
  }

  describe('create', () => {
    it('crée une mention avec un parcours et génère les slugs', async () => {
      stubDetailLookup();
      const result = await service.create(createDto());

      expect(mentionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          nom: 'Géomatique et applications',
          slug: 'geomatique-et-applications',
          domaine: 'Géomatique',
          isActive: true,
        }),
      );
      expect(parcoursRepo.save).toHaveBeenCalledTimes(1);
      expect(parcoursRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'geomatique-et-agriculture-durable', mentionId: 1 }),
      );
      expect(result.parcoursCount).toBe(1);
      expect(cacheService.invalidateResource).toHaveBeenCalled();
    });

    it('crée une mention avec plusieurs parcours en une seule transaction', async () => {
      stubDetailLookup();
      await service.create(
        createDto({
          parcours: [
            { nom: 'Géomatique et Géologie Économique' },
            { nom: 'Géomatique et Agriculture Durable' },
            { nom: 'Géomatique, Écosystème Terrestre et Aquatique' },
          ],
        }),
      );

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(parcoursRepo.save).toHaveBeenCalledTimes(1);
      const savedRows = firstCallArg<unknown[]>(parcoursRepo.save);
      expect(savedRows).toHaveLength(3);
      expect(parcoursRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'geomatique-et-geologie-economique' }),
      );
      expect(parcoursRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'geomatique-ecosysteme-terrestre-et-aquatique' }),
      );
    });

    it('normalise les accents et la casse du nom (slug + unicité)', async () => {
      stubDetailLookup();
      await service.create(createDto({ nom: 'GÉOMATIQUE ET APPLICATIONS' }));
      expect(mentionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'geomatique-et-applications' }),
      );
    });

    it('refuse une mention dont le nom existe déjà (409) sans ouvrir de transaction', async () => {
      mentionRepo.findOne.mockResolvedValue(FIXTURE_MENTION);
      await expect(service.create(createDto())).rejects.toThrow(ConflictException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('refuse les parcours dupliqués dans la même requête (400)', async () => {
      await expect(
        service.create(
          createDto({
            parcours: [
              { nom: 'Géomatique et Agriculture Durable' },
              { nom: 'geomatique-et-agriculture-durable' },
            ],
          }),
        ),
      ).rejects.toThrow(BadRequestException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('ne laisse aucun état partiel : la remontée d’erreur annule la transaction', async () => {
      stubDetailLookup();
      parcoursRepo.save.mockRejectedValueOnce(new Error('échec base de données'));

      await expect(
        service.create(
          createDto({
            parcours: [{ nom: 'Un parcours' }, { nom: 'Deux parcours' }, { nom: 'Trois parcours' }],
          }),
        ),
      ).rejects.toThrow('échec base de données');
      expect(cacheService.invalidateResource).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    beforeEach(() => {
      mentionRepo.findOne.mockImplementation((opts: { where?: { slug?: string } }) => {
        if (opts?.where?.slug) return Promise.resolve({ id: 99 });
        return Promise.resolve(FIXTURE_MENTION);
      });
    });

    it('refuse un renommage vers un nom existant (409)', async () => {
      await expect(service.update(10, { nom: 'Autre Mention' })).rejects.toThrow(ConflictException);
    });

    it('bloque la suppression d’un parcours utilisé par des formations', async () => {
      parcoursRepo.find.mockResolvedValueOnce([FIXTURE_PARCOURS]);
      formationRepo.createQueryBuilder.mockReturnValue(
        makeQueryBuilder({
          getRawMany: jest.fn(() => Promise.resolve([{ parcoursId: 20, count: '4' }])),
        }),
      );
      await expect(service.update(10, { parcours: [] })).rejects.toThrow(/utilisé par 4 formation/);
    });
  });

  describe('remove', () => {
    it('retourne 404 si la mention est inexistante', async () => {
      mentionRepo.findOne.mockResolvedValue(null);
      await expect(service.remove(42)).rejects.toThrow('Mention non trouvée');
    });

    it('bloque la suppression si des formations rattachées existent', async () => {
      mentionRepo.findOne.mockResolvedValue({ ...FIXTURE_MENTION, parcours: [FIXTURE_PARCOURS] });
      formationRepo.createQueryBuilder.mockReturnValue(
        makeQueryBuilder({
          getRawMany: jest.fn(() => Promise.resolve([{ parcoursId: 20, count: '2' }])),
        }),
      );
      await expect(service.remove(10, true)).rejects.toThrow(
        /2 formation\(s\) lui sont rattachées/,
      );
      expect(mentionRepo.delete).not.toHaveBeenCalled();
    });

    it('bloque sans cascade explicite si la mention a encore des parcours', async () => {
      mentionRepo.findOne.mockResolvedValue({ ...FIXTURE_MENTION, parcours: [FIXTURE_PARCOURS] });
      await expect(service.remove(10)).rejects.toThrow(/contient encore 1 parcours/);
    });

    it('supprime mention + parcours en cascade confirmée si aucune formation ne dépend', async () => {
      mentionRepo.findOne.mockResolvedValue({ ...FIXTURE_MENTION, parcours: [FIXTURE_PARCOURS] });
      await service.remove(10, true);
      expect(parcoursRepo.delete).toHaveBeenCalledWith({ mentionId: 10 });
      expect(mentionRepo.delete).toHaveBeenCalledWith(10);
    });
  });

  describe('lecture', () => {
    it('findOne renvoie 404 quand la mention est absente', async () => {
      mentionRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(7)).rejects.toThrow('Mention non trouvée');
    });

    it('findDistinctDomaines liste les domaines des mentions actives', async () => {
      mentionRepo.createQueryBuilder.mockReturnValue(
        makeQueryBuilder({
          getRawMany: jest.fn(() =>
            Promise.resolve([{ domaine: 'Géomatique' }, { domaine: 'Informatique' }]),
          ),
        }),
      );
      await expect(service.findDistinctDomaines()).resolves.toEqual(['Géomatique', 'Informatique']);
    });
  });
});
