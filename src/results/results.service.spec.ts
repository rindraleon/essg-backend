import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as ExcelJS from 'exceljs';
import { ResultsService } from './results.service';
import { StorageService } from '../common/storage/storage.service';
import { ActivityLogService } from '../activity-logs/activity-log.service';
import { ResultatPublication } from './entities/resultat-publication.entity';
import { ResultatIndividuel } from './entities/resultat-individuel.entity';
import {
  ResultatPublicationStatus,
  ResultatPublicationType,
  ResultatConsultationMode,
} from './entities/resultat-publication.entity';
import {
  PERMISSIONS,
  roleHasPermission,
  permissionsForRole,
  USER_ROLES,
} from '../users/users.constants';

describe('Permissions résultats', () => {
  it('l Administrateur dispose de toutes les permissions résultats', () => {
    for (const permission of [
      PERMISSIONS.RESULTAT_VIEW,
      PERMISSIONS.RESULTAT_CREATE,
      PERMISSIONS.RESULTAT_UPDATE,
      PERMISSIONS.RESULTAT_DELETE,
      PERMISSIONS.RESULTAT_PUBLISH,
    ]) {
      expect(roleHasPermission('admin', permission)).toBe(true);
    }
  });

  it('le rôle Scolarité peut gérer les résultats', () => {
    for (const permission of [
      PERMISSIONS.RESULTAT_VIEW,
      PERMISSIONS.RESULTAT_CREATE,
      PERMISSIONS.RESULTAT_UPDATE,
      PERMISSIONS.RESULTAT_DELETE,
      PERMISSIONS.RESULTAT_PUBLISH,
    ]) {
      expect(roleHasPermission('scolarite', permission)).toBe(true);
    }
  });

  it("l'Éditeur n’a aucun accès aux résultats", () => {
    for (const permission of [
      PERMISSIONS.RESULTAT_VIEW,
      PERMISSIONS.RESULTAT_CREATE,
      PERMISSIONS.RESULTAT_UPDATE,
      PERMISSIONS.RESULTAT_DELETE,
      PERMISSIONS.RESULTAT_PUBLISH,
    ]) {
      expect(roleHasPermission('editeur', permission)).toBe(false);
    }
  });
});

describe('ResultsService', () => {
  let service: ResultsService;
  let publicationRepository: jest.Mocked<Repository<ResultatPublication>>;
  let individuelsRepository: jest.Mocked<Repository<ResultatIndividuel>>;
  let storageService: jest.Mocked<StorageService>;

  const userId = 1;
  const userName = 'Admin ESSG';
  const ipAddress = '127.0.0.1';
  const endpoint = '/resultats/import';

  beforeEach(async () => {
    publicationRepository = {
      create: jest.fn((dto: unknown) => dto),
      save: jest.fn((entity: unknown) => entity),
      findOne: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<ResultatPublication>>;

    individuelsRepository = {
      create: jest.fn((dto: unknown) => dto),
      save: jest.fn((entities: unknown) => entities),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<ResultatIndividuel>>;

    storageService = {
      upload: jest.fn(),
      download: jest.fn(),
      deleteStoredRef: jest.fn(),
    } as unknown as jest.Mocked<StorageService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResultsService,
        { provide: getRepositoryToken(ResultatPublication), useValue: publicationRepository },
        { provide: getRepositoryToken(ResultatIndividuel), useValue: individuelsRepository },
        { provide: StorageService, useValue: storageService },
        { provide: ActivityLogService, useValue: { create: jest.fn().mockResolvedValue({}) } },
      ],
    }).compile();

    service = module.get(ResultsService);
  });

  it('refuse un fichier corrompu ou non pris en charge', async () => {
    const file = {
      buffer: Buffer.from('contenu qui n est pas un pdf'),
      originalname: 'document.pdf',
      mimetype: 'text/plain',
    } as Express.Multer.File;

    await expect(
      service.importResultat(
        file,
        {
          titre: 'Test',
          type: 'pdf',
          anneeScolaire: '2025-2026',
          modeConsultation: 'protege',
        },
        userId,
        userName,
        ipAddress,
        endpoint,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('accepte un PDF valide et crée une publication en brouillon', async () => {
    const pdfBuffer = Buffer.from('%PDF-1.4 fake pdf content');
    const file = {
      buffer: pdfBuffer,
      originalname: 'resultats.pdf',
      mimetype: 'application/pdf',
    } as Express.Multer.File;

    storageService.upload.mockResolvedValue({
      objectName: 'resultats/abc.pdf',
      url: 'resultats/abc.pdf',
    } as any);

    publicationRepository.save.mockImplementation((entity: any) => {
      entity.id = 7;
      return entity;
    });

    const result = await service.importResultat(
      file,
      {
        titre: 'Résultats S1',
        type: 'pdf',
        anneeScolaire: '2025-2026',
        modeConsultation: 'public',
        autorisePublicationPublique: true,
      },
      userId,
      userName,
      ipAddress,
      endpoint,
    );

    expect(result.publication.id).toBe(7);
    expect(result.publication.titre).toBe('Résultats S1');
    expect(result.publication.statutPublication).toBe(ResultatPublicationStatus.BROUILLON);
    expect(result.publication.type).toBe(ResultatPublicationType.PDF);
    expect(result.publication.autorisePublicationPublique).toBe(true);
    expect(result.preview.type).toBe('pdf');
    expect(storageService.upload).toHaveBeenCalled();
  });

  it('analyse un fichier Excel valide et signale les lignes valides et invalides', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Resultats');
    sheet.addRow(['Matricule', 'Nom', 'Prénom', 'Moyenne', 'Statut académique']);
    sheet.addRow(['MAT001', 'RAKOTO', 'Jean', 14, 'admis']);
    sheet.addRow(['', 'RANDRIANA', 'Marie', null, 'ajourne']); // matricule manquant
    const buffer = await workbook.xlsx.writeBuffer();

    const file = {
      buffer: buffer as unknown as Buffer,
      originalname: 'notes.xlsx',
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    } as Express.Multer.File;

    storageService.upload.mockResolvedValue({
      objectName: 'resultats/def.xlsx',
    } as any);
    publicationRepository.save.mockImplementation((entity: any) => {
      entity.id = 9;
      return entity;
    });

    const result = await service.importResultat(
      file,
      {
        titre: 'Notes S1',
        type: 'excel',
        anneeScolaire: '2025-2026',
        modeConsultation: 'protege',
      },
      userId,
      userName,
      ipAddress,
      endpoint,
    );

    expect(result.publication.type).toBe(ResultatPublicationType.EXCEL);
    const valides = result.preview.lignes.filter((l) => l.valide);
    const invalides = result.preview.lignes.filter((l) => !l.valide);
    expect(valides.length).toBe(1);
    expect(invalides.length).toBe(1);
    expect(result.preview.lignesValides).toBe(1);
    expect(result.preview.lignesInvalides).toBe(1);
    expect(valides[0].matricule).toBe('MAT001');
    expect(valides[0].nom).toBe('RAKOTO');
    expect(invalides[0].erreurs.length).toBeGreaterThan(0);
  });

  it('lève NotFoundException si la publication est introuvable', async () => {
    publicationRepository.findOne.mockResolvedValue(null);
    await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
  });

  it('refuse la confirmation d’une publication déjà publiée', async () => {
    publicationRepository.findOne.mockResolvedValue({
      id: 5,
      statutPublication: ResultatPublicationStatus.PUBLIE,
      type: ResultatPublicationType.EXCEL,
      fichierOriginal: 'notes.xlsx',
      objetChemin: 'resultats/notes.xlsx',
    } as any);
    await expect(
      service.confirmerImportation(5, userId, userName, ipAddress, endpoint),
    ).rejects.toThrow(ConflictException);
  });

  it('toutes les positions de rôle incluent scolarite et admin pour les résultats', () => {
    const rolesWithView = USER_ROLES.filter((r) => roleHasPermission(r, PERMISSIONS.RESULTAT_VIEW));
    expect(rolesWithView).toContain('admin');
    expect(rolesWithView).toContain('scolarite');
    expect(rolesWithView).not.toContain('editeur');
  });
});
