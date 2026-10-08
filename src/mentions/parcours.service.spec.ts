import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Parcours } from './entities/parcours.entity';
import { ParcoursService } from './parcours.service';
import { firstCallArg, makeRepo, type RepoMock } from './spec-helpers';

const FIXTURE: Parcours = {
  id: 5,
  mentionId: 1,
  nom: 'Géomatique et Agriculture Durable',
  slug: 'geomatique-et-agriculture-durable',
  isActive: true,
  creeLe: new Date('2026-01-01'),
  misAJourLe: new Date('2026-01-01'),
};

describe('ParcoursService', () => {
  let service: ParcoursService;
  let parcoursRepo: RepoMock;
  let mentionRepo: RepoMock;
  let formationRepo: RepoMock;

  beforeEach(() => {
    parcoursRepo = makeRepo({
      findOne: jest.fn((opts: { where?: { id?: number } }) =>
        Promise.resolve(opts?.where?.id !== undefined ? { ...FIXTURE } : null),
      ),
      save: jest.fn((input: unknown) => Promise.resolve({ id: 5, ...(input as object) })),
    });
    mentionRepo = makeRepo({
      findOne: jest.fn(() => Promise.resolve({ id: 1 })),
    });
    formationRepo = makeRepo();
    const cache = { invalidateResource: jest.fn() };
    service = new ParcoursService(
      parcoursRepo as unknown as never,
      mentionRepo as unknown as never,
      formationRepo as unknown as never,
      cache as unknown as never,
    );
  });

  describe('create', () => {
    it('rattache le parcours à la mention et génère le slug', async () => {
      await service.create({ mentionId: 1, nom: 'Géomatique et agriculture durable' });
      expect(parcoursRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mentionId: 1,
          slug: 'geomatique-et-agriculture-durable',
        }),
      );
    });

    it('refuse un parcours sans mention existante (400)', async () => {
      mentionRepo.findOne.mockResolvedValue(null);
      await expect(service.create({ mentionId: 999, nom: 'Bidon' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('refuse un doublon dans la même mention (409)', async () => {
      parcoursRepo.findOne.mockImplementation((opts: { where?: { slug?: string } }) =>
        Promise.resolve(opts?.where?.slug ? { id: 42 } : null),
      );
      await expect(
        service.create({ mentionId: 1, nom: 'Géomatique et Agriculture Durable' }),
      ).rejects.toThrow(ConflictException);
    });

    it('autorise le même nom de parcours dans deux mentions différentes', async () => {
      await expect(
        service.create({ mentionId: 2, nom: 'Géomatique et Agriculture Durable' }),
      ).resolves.toMatchObject({ nom: 'Géomatique et Agriculture Durable' });
    });
  });

  describe('update', () => {
    it('renomme et régénère le slug du parcours', async () => {
      await service.update(5, { nom: 'Géomatique et Agronomie' });
      const payload = firstCallArg<{ slug: string }>(parcoursRepo.update, 1);
      expect(payload.slug).toBe('geomatique-et-agronomie');
    });

    it('refuse de déplacer un parcours utilisé par des formations (400)', async () => {
      formationRepo.count.mockResolvedValue(3);
      await expect(service.update(5, { mentionId: 7 })).rejects.toThrow(
        /3 formation\(s\) l'utilisent/,
      );
    });

    it('valide la mention cible lors d’un déplacement', async () => {
      formationRepo.count.mockResolvedValue(0);
      mentionRepo.findOne.mockResolvedValue(null);
      await expect(service.update(5, { mentionId: 99 })).rejects.toThrow(
        'La mention sélectionnée est introuvable.',
      );
    });

    it('retourne 404 si le parcours est introuvable', async () => {
      parcoursRepo.findOne.mockResolvedValue(null);
      await expect(service.update(404, { nom: 'Nom' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('bloque la suppression si le parcours est utilisé par des formations', async () => {
      formationRepo.count.mockResolvedValue(4);
      await expect(service.remove(5)).rejects.toThrow(
        /Ce parcours est utilisé par 4 formation\(s\)/,
      );
      expect(parcoursRepo.delete).not.toHaveBeenCalled();
    });

    it('supprime un parcours libre', async () => {
      formationRepo.count.mockResolvedValue(0);
      await service.remove(5);
      expect(parcoursRepo.delete).toHaveBeenCalledWith(5);
    });

    it('retourne 404 si le parcours est introuvable', async () => {
      parcoursRepo.findOne.mockResolvedValue(null);
      await expect(service.remove(404)).rejects.toThrow(NotFoundException);
    });
  });
});
