import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import pdfParse from 'pdf-parse';
import { ResultatPublication } from './entities/resultat-publication.entity';

const parsePdf = pdfParse as unknown as (buffer: Buffer) => Promise<{ text?: string }>;
import { ResultatIndividuel } from './entities/resultat-individuel.entity';
import {
  ResultatPublicationType,
  ResultatPublicationStatus,
  ResultatConsultationMode,
} from './entities/resultat-publication.entity';
import { StatutAcademique } from './entities/resultat-individuel.entity';
import {
  CreateResultatPublicationDto,
  QueryResultatPublicationDto,
  UpdateResultatPublicationDto,
  ResultatImportPreview,
  ResultatImportPreviewRow,
} from './dto/create-resultat-publication.dto';
import type { PaginatedData } from '../common/interfaces/api-response.interface';
import { buildPaginatedData } from '../common/utils/pagination.util';
import { buildIlikeTerm, ILIKE_ESCAPE, sanitizeSortField } from '../common/utils/search.util';
import { detectFileType } from '../common/utils/file-type.util';
import { StorageService } from '../common/storage/storage.service';
import type { StorageUploadResult } from '../common/storage/interfaces/storage.interface';
import { STORAGE_PREFIXES } from '../common/storage/storage.constants';
import { ActivityLogService } from '../activity-logs/activity-log.service';

export const RESULTAT_FILE_MAX_SIZE = 10 * 1024 * 1024;

const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.pdf'];
export const RESULTAT_ACCEPTED_MIMES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/pdf',
];

const SORT_FIELDS = [
  'id',
  'titre',
  'type',
  'anneeScolaire',
  'periode',
  'classeFormation',
  'statutPublication',
  'modeConsultation',
  'creeLe',
  'misAJourLe',
] as const;

const MATRICULE_ALIASES = [
  'matricule',
  'numero matricule',
  'numéro matricule',
  'matricule etudiant',
  'matricule étudiant',
  'code matricule',
  "numéro d'immatriculation",
];
const NOM_ALIASES = ['nom', 'nom etudiant', 'nom étudiant', 'nom complet'];
const PRENOM_ALIASES = ['prenom', 'prénom', 'prenom etudiant', 'prénom étudiant'];
const CLASSE_ALIASES = ['classe', 'formation', 'promotion', 'niveau'];
const PERIODE_ALIASES = ['periode', 'période', 'semestre', 'session', 'trimestre'];
const MOYENNE_ALIASES = ['moyenne', 'moyenne generale', 'moyenne générale', 'moy.'];
const STATUT_ALIASES = [
  'statut',
  'statut academique',
  'statut académique',
  'admis ajourne',
  'admis/ajourne',
];
const OBSERVATION_ALIASES = ['observation', 'remarque', 'commentaire'];

interface DetectedColumn {
  key:
    | 'matricule'
    | 'nom'
    | 'prenom'
    | 'classe'
    | 'periode'
    | 'moyenne'
    | 'statutAcademique'
    | 'observation'
    | 'note';
  header: string;
  index: number;
}

@Injectable()
export class ResultsService {
  private readonly logger = new Logger(ResultsService.name);

  constructor(
    @InjectRepository(ResultatPublication)
    private readonly publicationRepository: Repository<ResultatPublication>,
    @InjectRepository(ResultatIndividuel)
    private readonly individuelsRepository: Repository<ResultatIndividuel>,
    private readonly storageService: StorageService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  private async logAction({
    userId,
    userName,
    action,
    description,
    method,
    endpoint,
    statusCode,
    success,
    ipAddress,
    metadata,
  }: {
    userId: number | null;
    userName: string | null;
    action: string;
    description: string;
    method: string;
    endpoint: string;
    statusCode: number;
    success: boolean;
    ipAddress?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<void> {
    await this.activityLogService
      .create({
        userId,
        userName,
        action,
        description,
        method,
        endpoint,
        module: 'resultats',
        statusCode,
        success,
        ipAddress: ipAddress ?? null,
        metadata: metadata ?? null,
      })
      .catch((error) => {
        this.logger.warn(
          'Échec de la journalisation d’activité (module resultats)',
          error instanceof Error ? error.stack : String(error),
        );
      });
  }

  private validateFile(file: Express.Multer.File): void {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Fichier vide ou absent.');
    }

    const extensionMatch = /\.([^.]+)$/.exec(file.originalname);
    const extension = (extensionMatch?.[1] ?? '').toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(`.${extension}`)) {
      throw new BadRequestException(
        `Format de fichier non pris en charge (${file.originalname}). Formats acceptés : ${ACCEPTED_EXTENSIONS.join(', ')}.`,
      );
    }

    if (!RESULTAT_ACCEPTED_MIMES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Type MIME non autorisé pour le fichier « ${file.originalname} » (${file.mimetype}).`,
      );
    }

    const detected = detectFileType(file.buffer, file.mimetype);

    // Le PDF possède une signature magique fiable (%PDF). Les fichiers Excel
    // (.xlsx/.xls) partagent la signature ZIP avec d'autres formats bureautiques
    // (ex. .docx) : on ne peut pas les distinguer uniquement aux magic bytes.
    // Leur intégrité est ensuite vérifiée par l'analyse ExcelJS.
    if (extension === 'pdf' && detected.mimetype !== 'application/pdf') {
      throw new BadRequestException(
        `Le fichier « ${file.originalname} » est corrompu ou n’est pas un PDF valide (signature détectée : ${detected.mimetype}).`,
      );
    }

    if (file.buffer.length > RESULTAT_FILE_MAX_SIZE) {
      throw new BadRequestException(
        `Le fichier « ${file.originalname} » dépasse la taille maximale de 10 Mo.`,
      );
    }
  }

  private resolvePrivateObject(dto: CreateResultatPublicationDto): boolean {
    return dto.modeConsultation === 'protege';
  }

  async importResultat(
    file: Express.Multer.File,
    dto: CreateResultatPublicationDto,
    userId: number,
    userName: string | null,
    ipAddress: string | null,
    endpoint: string,
  ): Promise<{ publication: ResultatPublication; preview: ResultatImportPreview }> {
    this.validateFile(file);

    const extensionMatch = /\.([^.]+)$/.exec(file.originalname);
    const extension = (extensionMatch?.[1] ?? '').toLowerCase();
    if (extension === 'xls') {
      throw new BadRequestException(
        'Le format .xls n’est pas pris en charge pour l’importation. Enregistrez le fichier au format .xlsx puis réessayez.',
      );
    }
    const isExcel = extension === 'xlsx';
    const type = isExcel ? ResultatPublicationType.EXCEL : ResultatPublicationType.PDF;
    const privateObject = this.resolvePrivateObject(dto);

    let stored: StorageUploadResult;
    try {
      stored = await this.storageService.upload(file.buffer, file.originalname, {
        mimetype: file.mimetype,
        prefix: STORAGE_PREFIXES.documents,
        privateObject,
        metadata: {
          'x-amz-meta-module': 'resultats',
          'x-amz-meta-type': type,
          'x-amz-meta-annee': dto.anneeScolaire,
        },
      });
    } catch (error) {
      this.logger.error(
        'Échec du stockage du fichier de résultat',
        error instanceof Error ? error.stack : String(error),
      );
      throw new ServiceUnavailableException(
        'Impossible d’enregistrer le fichier dans le stockage. Aucune publication n’a été créée.',
      );
    }

    const publication = this.publicationRepository.create({
      titre: dto.titre,
      type,
      anneeScolaire: dto.anneeScolaire,
      periode: dto.periode ?? null,
      classeFormation: dto.classeFormation ?? null,
      fichierOriginal: file.originalname,
      objetChemin: stored.objectName,
      mimeType: file.mimetype,
      taille: file.buffer.length,
      statutPublication: ResultatPublicationStatus.BROUILLON,
      modeConsultation: dto.modeConsultation as ResultatConsultationMode,
      autorisePublicationPublique:
        type === ResultatPublicationType.PDF &&
        (dto.autorisePublicationPublique === true || dto.modeConsultation === 'public'),
      creePar: userId,
    });

    let saved: ResultatPublication;
    try {
      saved = await this.publicationRepository.save(publication);
    } catch (error) {
      await this.storageService.deleteStoredRef(stored.objectName);
      this.logger.error(
        'Échec de l’enregistrement de la publication de résultat',
        error instanceof Error ? error.stack : String(error),
      );
      throw new ServiceUnavailableException(
        'Impossible d’enregistrer la publication en base. Le fichier a été retiré du stockage.',
      );
    }

    await this.logAction({
      userId,
      userName,
      action: 'importation',
      description: `Importation du fichier "${file.originalname}" (publication #${saved.id}, type ${type}, statut brouillon).`,
      method: 'POST',
      endpoint,
      statusCode: 201,
      success: true,
      ipAddress,
      metadata: { publicationId: saved.id, type, fichier: file.originalname },
    });

    const preview =
      isExcel && extension === 'xlsx'
        ? await this.previewExcel(file.buffer, saved.id)
        : {
            type: (extension === 'pdf' ? 'pdf' : 'excel') as 'excel' | 'pdf' | 'inconnu',
            feuille: null,
            colonnes: [],
            lignes: [],
            totalLignes: 0,
            lignesValides: 0,
            lignesInvalides: 0,
            doublons: 0,
            message:
              extension === 'xls'
                ? 'Le format .xls binaire n’est pas analysé automatiquement. Le fichier est conservé comme document joint.'
                : 'Document PDF importé. Consultez ou téléchargez le fichier selon les droits d’accès.',
          };

    return { publication: saved, preview };
  }

  private async previewExcel(
    buffer: Buffer,
    publicationId: number,
  ): Promise<ResultatImportPreview> {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer as any);
    } catch {
      throw new BadRequestException(
        'Impossible de lire le fichier Excel. Le fichier est peut-être corrompu.',
      );
    }

    const worksheet = workbook.worksheets.length > 0 ? workbook.worksheets[0] : null;
    if (!worksheet) {
      throw new BadRequestException(
        'Le fichier Excel ne contient aucune feuille de calcul utilisable.',
      );
    }

    const rows = worksheet.getSheetValues();
    if (rows.length < 2) {
      return {
        type: 'excel',
        feuille: worksheet.name,
        colonnes: [],
        lignes: [],
        totalLignes: 0,
        lignesValides: 0,
        lignesInvalides: 0,
        doublons: 0,
        message: 'Aucune ligne de résultat détectée dans la feuille.',
      };
    }

    // La première ligne non vide est traitée comme la ligne d’en-tête.
    let headerRowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      const r = (rows[i] ?? []) as unknown[];
      if (r.some((cell) => cell !== null && cell !== undefined && cell !== '')) {
        headerRowIndex = i;
        break;
      }
    }
    if (headerRowIndex === -1) {
      return {
        type: 'excel',
        feuille: worksheet.name,
        colonnes: [],
        lignes: [],
        totalLignes: 0,
        lignesValides: 0,
        lignesInvalides: 0,
        doublons: 0,
        message: 'Aucune ligne de résultat détectée dans la feuille.',
      };
    }

    const headerRow = (rows[headerRowIndex] ?? []) as unknown[];
    const columns: string[] = [];
    const detected: DetectedColumn[] = [];

    headerRow.forEach((cell, index) => {
      const header = this.cellToText(cell) ?? '';
      columns.push(header);
      const key = this.classifyColumn(header);
      if (key) {
        detected.push({ key, header, index });
      }
    });

    const missingColumns = [
      { key: 'matricule' as const, label: 'matricule' },
      { key: 'nom' as const, label: 'nom' },
      { key: 'prenom' as const, label: 'prénom' },
    ]
      .filter(({ key }) => !detected.some((column) => column.key === key))
      .map(({ label }) => label);

    const existingMatricules = await this.individuelsRepository.find({
      where: { publicationId },
      select: ['matricule'],
    });
    const existingMatriculeSet = new Set(existingMatricules.map((row) => row.matricule));
    const fileMatriculeSet = new Set<string>();

    const lignes: ResultatImportPreviewRow[] = [];
    let lignesValides = 0;
    let lignesInvalides = 0;
    let doublons = 0;

    for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex++) {
      const row = (rows[rowIndex] ?? []) as unknown[];
      if (this.isEmptyRow(row) || this.isInstructionRow(row)) {
        continue;
      }
      const numeroLigne = rowIndex + 1;
      const erreurs: string[] = [];

      const matricule = this.readCell(
        row,
        detected.find((d) => d.key === 'matricule'),
      );
      const nom = this.readCell(
        row,
        detected.find((d) => d.key === 'nom'),
      );
      const prenom = this.readCell(
        row,
        detected.find((d) => d.key === 'prenom'),
      );
      const classe = this.readCell(
        row,
        detected.find((d) => d.key === 'classe'),
      );
      const periode = this.readCell(
        row,
        detected.find((d) => d.key === 'periode'),
      );
      const moyenneRaw = this.readCell(
        row,
        detected.find((d) => d.key === 'moyenne'),
      );
      const statutAcademiqueRaw = this.readCell(
        row,
        detected.find((d) => d.key === 'statutAcademique'),
      );
      const observation = this.readCell(
        row,
        detected.find((d) => d.key === 'observation'),
      );

      const notes: Record<string, unknown> = {};
      detected
        .filter((d) => d.key === 'note')
        .forEach((d) => {
          const value = this.readCell(row, d);
          if (value !== null) {
            notes[d.header] = value;
          }
        });

      let moyenne: number | null = null;
      if (moyenneRaw !== null) {
        const parsed = Number(moyenneRaw);
        if (!Number.isFinite(parsed)) {
          erreurs.push(`Moyenne invalide : "${moyenneRaw}".`);
        } else {
          moyenne = parsed;
        }
      }

      let statutAcademique: StatutAcademique | null = null;
      if (statutAcademiqueRaw !== null) {
        const lower = statutAcademiqueRaw.toLowerCase();
        if (lower === 'admis') statutAcademique = StatutAcademique.ADMIS;
        else if (lower === 'ajourne' || lower === 'ajourné')
          statutAcademique = StatutAcademique.AJOURNE;
        else
          erreurs.push(
            `Statut académique invalide : "${statutAcademiqueRaw}" (valeurs attendues : admis, ajourne).`,
          );
      }

      if (!matricule) erreurs.push('Matricule manquant.');
      if (!nom) erreurs.push('Nom manquant.');
      if (!prenom) erreurs.push('Prénom manquant.');

      let doublon = false;
      if (matricule) {
        if (existingMatriculeSet.has(matricule)) {
          doublon = true;
          erreurs.push(`Matricule déjà présent dans cette publication.`);
        }
        if (fileMatriculeSet.has(matricule)) {
          doublon = true;
          erreurs.push(`Matricule en double dans le fichier.`);
        }
        fileMatriculeSet.add(matricule);
      }

      const valide = erreurs.length === 0 && !!matricule && !!nom && !!prenom;
      if (valide) lignesValides++;
      else lignesInvalides++;
      if (doublon) doublons++;

      lignes.push({
        numeroLigne,
        matricule,
        nom,
        prenom,
        classe,
        periode,
        notes: Object.keys(notes).length ? notes : null,
        moyenne,
        statutAcademique,
        observation,
        valide,
        erreurs,
        doublon,
      });
    }

    let message: string;
    if (lignesInvalides === 0 && doublons === 0) {
      message = `Fichier Excel analysé : ${lignesValides} ligne(s) valide(s) détectée(s).`;
    } else {
      const parties: string[] = [];
      if (lignesValides > 0) parties.push(`${lignesValides} valide(s)`);
      if (lignesInvalides > 0) parties.push(`${lignesInvalides} invalide(s)`);
      if (doublons > 0) parties.push(`${doublons} doublon(s)`);
      message = `Fichier Excel analysé : ${parties.join(', ')}.`;
    }

    if (missingColumns.length > 0) {
      message = `Colonnes obligatoires manquantes : ${missingColumns.join(', ')}. ` + message;
    }

    return {
      type: 'excel',
      feuille: worksheet.name,
      colonnes: columns,
      lignes,
      totalLignes: lignes.length,
      lignesValides,
      lignesInvalides,
      doublons,
      message,
    };
  }

  async previewPdf(buffer: Buffer): Promise<{ textLength: number }> {
    try {
      const data = await parsePdf(buffer);
      return { textLength: data.text?.length ?? 0 };
    } catch (error) {
      this.logger.warn(
        'Impossible d’extraire le texte du PDF (consultation du document uniquement).',
        error instanceof Error ? error.message : String(error),
      );
      return { textLength: 0 };
    }
  }

  async confirmerImportation(
    id: number,
    userId: number,
    userName: string | null,
    ipAddress: string | null,
    endpoint: string,
  ): Promise<{
    publication: ResultatPublication;
    inseres: number;
    ignores: number;
    doublons: number;
    erreurs: number;
  }> {
    const publication = await this.publicationRepository.findOne({
      where: { id },
    });
    if (!publication) {
      throw new NotFoundException('Publication de résultat introuvable.');
    }
    if (publication.statutPublication !== ResultatPublicationStatus.BROUILLON) {
      throw new ConflictException('Seule une publication en brouillon peut être confirmée.');
    }
    if (publication.type !== ResultatPublicationType.EXCEL) {
      throw new BadRequestException(
        'Seul un fichier Excel peut être confirmé pour importer des résultats individuels.',
      );
    }

    let buffer: Buffer;
    try {
      buffer = await this.storageService.download(publication.objetChemin);
    } catch (error) {
      this.logger.error(
        `Fichier introuvable dans le stockage pour la publication #${id}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new ServiceUnavailableException(
        'Le fichier source est introuvable dans le stockage. L’importation ne peut pas être confirmée.',
      );
    }

    const extensionMatch = /\.([^.]+)$/.exec(publication.fichierOriginal);
    const extension = (extensionMatch?.[1] ?? '').toLowerCase();
    if (extension !== 'xlsx') {
      throw new BadRequestException(
        'L’extraction des résultats individuels nécessite un fichier .xlsx.',
      );
    }

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer as any);
    } catch {
      throw new BadRequestException('Impossible de lire le fichier Excel lors de la confirmation.');
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new BadRequestException('Le fichier Excel ne contient aucune feuille de calcul.');
    }

    const rows = worksheet.getSheetValues();
    // La première ligne non vide est traitée comme la ligne d’en-tête.
    let headerRowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      const r = (rows[i] ?? []) as unknown[];
      if (r.some((cell) => cell !== null && cell !== undefined && cell !== '')) {
        headerRowIndex = i;
        break;
      }
    }
    if (headerRowIndex === -1) {
      throw new BadRequestException('Le fichier Excel ne contient aucune ligne de donnée.');
    }

    const headerRow = (rows[headerRowIndex] ?? []) as unknown[];
    const detected: DetectedColumn[] = [];
    headerRow.forEach((cell, index) => {
      const header = this.cellToText(cell) ?? '';
      const key = this.classifyColumn(header);
      if (key) detected.push({ key, header, index });
    });

    const hasMatricule = detected.some((d) => d.key === 'matricule');
    const hasNom = detected.some((d) => d.key === 'nom');
    const hasPrenom = detected.some((d) => d.key === 'prenom');
    if (!hasMatricule || !hasNom || !hasPrenom) {
      throw new BadRequestException(
        'Le fichier Excel doit contenir au minimum les colonnes matricule, nom et prénom.',
      );
    }

    const existingMatricules = await this.individuelsRepository.find({
      where: { publicationId: id },
      select: ['matricule'],
    });
    const existingSet = new Set(existingMatricules.map((row) => row.matricule));
    const fileSet = new Set<string>();

    const toInsert: ResultatIndividuel[] = [];
    const ignores = 0;
    let doublons = 0;
    let erreurs = 0;

    for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex++) {
      const row = (rows[rowIndex] ?? []) as unknown[];
      if (this.isEmptyRow(row) || this.isInstructionRow(row)) {
        continue;
      }
      const matricule = this.readCell(
        row,
        detected.find((d) => d.key === 'matricule'),
      );
      const nom = this.readCell(
        row,
        detected.find((d) => d.key === 'nom'),
      );
      const prenom = this.readCell(
        row,
        detected.find((d) => d.key === 'prenom'),
      );

      if (!matricule || !nom || !prenom) {
        erreurs++;
        continue;
      }

      if (existingSet.has(matricule) || fileSet.has(matricule)) {
        doublons++;
        continue;
      }
      fileSet.add(matricule);

      const classe = this.readCell(
        row,
        detected.find((d) => d.key === 'classe'),
      );
      const periode = this.readCell(
        row,
        detected.find((d) => d.key === 'periode'),
      );
      const observation = this.readCell(
        row,
        detected.find((d) => d.key === 'observation'),
      );

      const notes: Record<string, unknown> = {};
      detected
        .filter((d) => d.key === 'note')
        .forEach((d) => {
          const value = this.readCell(row, d);
          if (value !== null) {
            notes[d.header] = value;
          }
        });

      let moyenne: number | null = null;
      const moyenneRaw = this.readCell(
        row,
        detected.find((d) => d.key === 'moyenne'),
      );
      if (moyenneRaw !== null) {
        const parsed = Number(moyenneRaw);
        moyenne = Number.isFinite(parsed) ? parsed : null;
      }

      let statutAcademique: StatutAcademique | null = null;
      const statutRaw = this.readCell(
        row,
        detected.find((d) => d.key === 'statutAcademique'),
      );
      if (statutRaw !== null) {
        const lower = statutRaw.toLowerCase();
        if (lower === 'admis') statutAcademique = StatutAcademique.ADMIS;
        else if (lower === 'ajourne' || lower === 'ajourné')
          statutAcademique = StatutAcademique.AJOURNE;
      }

      const codeConsultation = this.generateConsultationCode();

      toInsert.push(
        this.individuelsRepository.create({
          publicationId: id,
          matricule,
          nom,
          prenom,
          classe: classe ?? null,
          periode: periode ?? null,
          notes: Object.keys(notes).length ? notes : null,
          moyenne,
          statutAcademique,
          observation: observation ?? null,
          codeConsultation,
        }),
      );
    }

    let inseres = 0;
    if (toInsert.length > 0) {
      try {
        const saved = await this.individuelsRepository.save(toInsert);
        inseres = saved.length;
      } catch (error) {
        const pgError = error as { code?: string; detail?: string };
        if (pgError?.code === '23505') {
          throw new ConflictException(
            'Des doublons de matricule ont été détectés lors de l’enregistrement. Aucun résultat n’a été écrasé.',
          );
        }
        throw error;
      }
    }

    const [totalIndividuels, totalAdmis, totalAjourne] = await Promise.all([
      this.individuelsRepository.count({ where: { publicationId: id } }),
      this.individuelsRepository.count({
        where: { publicationId: id, statutAcademique: StatutAcademique.ADMIS },
      }),
      this.individuelsRepository.count({
        where: { publicationId: id, statutAcademique: StatutAcademique.AJOURNE },
      }),
    ]);
    publication.totalIndividuels = totalIndividuels;
    publication.totalAdmis = totalAdmis;
    publication.totalAjourne = totalAjourne;
    await this.publicationRepository.save(publication);

    await this.logAction({
      userId,
      userName,
      action: 'importation_confirmee',
      description: `Confirmation de l’importation Excel de la publication #${id} : ${inseres} résultat(s) inséré(s), ${doublons} doublon(s) ignoré(s), ${erreurs} ligne(s) invalide(s).`,
      method: 'POST',
      endpoint,
      statusCode: 200,
      success: true,
      ipAddress,
      metadata: { publicationId: id, inseres, doublons, erreurs },
    });

    return {
      publication,
      inseres,
      ignores,
      doublons,
      erreurs,
    };
  }

  private generateConsultationCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    for (let i = 0; i < 8; i++) {
      code += chars[bytes[i] % chars.length];
    }
    return code;
  }

  private normalizeHeader(header: string): string {
    return header
      .toLowerCase()
      .replace(/[àâä]/g, 'a')
      .replace(/[èéêë]/g, 'e')
      .replace(/[îï]/g, 'i')
      .replace(/[ôö]/g, 'o')
      .replace(/[ùûü]/g, 'u')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9]/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  private headerMatches(normalized: string, aliases: string[]): boolean {
    return aliases.some((a) => {
      const clean = a
        .replace(/[^a-z0-9]/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');
      // Correspondance exacte pour les alias d’un seul mot (évite que "prenom"
      // ne soit confondu avec "nom"), inclusion pour les alias composés.
      return normalized === clean || (clean.includes(' ') && normalized.includes(clean));
    });
  }

  private cellToText(raw: unknown): string | null {
    if (raw === null || raw === undefined) return null;

    if (raw instanceof Date) {
      return Number.isNaN(raw.getTime()) ? null : raw.toISOString().slice(0, 10);
    }

    if (typeof raw === 'object') {
      const value = raw as {
        result?: unknown;
        text?: unknown;
        richText?: Array<{ text?: string }>;
        hyperlink?: unknown;
      };
      if (value.result !== undefined) return this.cellToText(value.result);
      if (typeof value.text === 'string') return this.cellToText(value.text);
      if (Array.isArray(value.richText)) {
        const joined = value.richText.map((part) => part.text ?? '').join('');
        return this.cellToText(joined);
      }
      if (typeof value.hyperlink === 'string') return this.cellToText(value.hyperlink);
      return null;
    }

    if (typeof raw === 'string') {
      const text = raw.trim();
      return text === '' ? null : text;
    }

    if (typeof raw === 'number' || typeof raw === 'boolean' || typeof raw === 'bigint') {
      return String(raw);
    }

    return null;
  }

  private readCell(row: unknown[], col: { index: number } | undefined): string | null {
    if (!col) return null;
    return this.cellToText(row[col.index]);
  }

  private isEmptyRow(row: unknown[]): boolean {
    return row.every((cell) => this.cellToText(cell) === null);
  }

  /**
   * Ignore les lignes de consigne (« Note : … », « Remarque : … ») que
   * l’on retrouve parfois sous le tableau dans les fichiers réalisés à la main.
   */
  private isInstructionRow(row: unknown[]): boolean {
    const firstValue = row.map((cell) => this.cellToText(cell)).find((value) => value !== null);
    if (!firstValue) return false;
    return /^(note|remarque|important|astuce|conseil|les colonnes|colonnes obligatoires)\b/i.test(
      firstValue,
    );
  }

  private classifyColumn(header: string): DetectedColumn['key'] | null {
    const normalized = this.normalizeHeader(header);

    if (this.headerMatches(normalized, MATRICULE_ALIASES)) return 'matricule';
    if (this.headerMatches(normalized, NOM_ALIASES)) return 'nom';
    if (this.headerMatches(normalized, PRENOM_ALIASES)) return 'prenom';
    if (this.headerMatches(normalized, CLASSE_ALIASES)) return 'classe';
    if (this.headerMatches(normalized, PERIODE_ALIASES)) return 'periode';
    if (this.headerMatches(normalized, MOYENNE_ALIASES)) return 'moyenne';
    if (this.headerMatches(normalized, STATUT_ALIASES)) return 'statutAcademique';
    if (this.headerMatches(normalized, OBSERVATION_ALIASES)) return 'observation';

    if (
      normalized &&
      normalized !== 'notes' &&
      !['moyenne', 'statut', 'observation'].includes(normalized)
    ) {
      return 'note';
    }
    return null;
  }

  async findAll(query: QueryResultatPublicationDto): Promise<PaginatedData<ResultatPublication>> {
    const {
      page = 1,
      limit = 10,
      sortBy,
      sortOrder = 'DESC',
      q,
      anneeScolaire,
      periode,
      classeFormation,
      type,
      statutPublication,
    } = query;

    const qb = this.publicationRepository.createQueryBuilder('pub');

    if (q?.trim()) {
      const term = buildIlikeTerm(q);
      qb.andWhere(
        `(pub.titre ILIKE :term ${ILIKE_ESCAPE}
          OR pub.fichierOriginal ILIKE :term ${ILIKE_ESCAPE}
          OR pub.anneeScolaire ILIKE :term ${ILIKE_ESCAPE}
          OR pub.classeFormation ILIKE :term ${ILIKE_ESCAPE}
          OR pub.periode ILIKE :term ${ILIKE_ESCAPE})`,
        { term },
      );
    }

    if (anneeScolaire) {
      qb.andWhere('pub.anneeScolaire = :anneeScolaire', { anneeScolaire });
    }

    if (periode) {
      qb.andWhere('pub.periode = :periode', { periode });
    }

    if (classeFormation) {
      qb.andWhere('pub.classeFormation ILIKE :classeFormation', {
        classeFormation: buildIlikeTerm(classeFormation),
      });
    }

    if (type) {
      qb.andWhere('pub.type = :type', { type });
    }

    if (statutPublication) {
      qb.andWhere('pub.statutPublication = :statutPublication', {
        statutPublication,
      });
    }

    const orderField = sanitizeSortField(sortBy, SORT_FIELDS) ?? 'creeLe';
    qb.orderBy(`pub.${orderField}`, sortOrder === 'ASC' ? 'ASC' : 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return buildPaginatedData(items, total, page, limit);
  }

  async findPublic(
    query: QueryResultatPublicationDto,
  ): Promise<PaginatedData<ResultatPublication>> {
    const {
      page = 1,
      limit = 10,
      sortBy,
      sortOrder = 'DESC',
      q,
      anneeScolaire,
      periode,
      classeFormation,
      type,
    } = query;

    const qb = this.publicationRepository.createQueryBuilder('pub');
    qb.andWhere('pub.statutPublication = :statut', {
      statut: ResultatPublicationStatus.PUBLIE,
    });

    if (q?.trim()) {
      const term = buildIlikeTerm(q);
      qb.andWhere(
        `(pub.titre ILIKE :term ${ILIKE_ESCAPE}
          OR pub.fichierOriginal ILIKE :term ${ILIKE_ESCAPE}
          OR pub.anneeScolaire ILIKE :term ${ILIKE_ESCAPE}
          OR pub.classeFormation ILIKE :term ${ILIKE_ESCAPE}
          OR pub.periode ILIKE :term ${ILIKE_ESCAPE})`,
        { term },
      );
    }

    if (anneeScolaire) {
      qb.andWhere('pub.anneeScolaire = :anneeScolaire', { anneeScolaire });
    }

    if (periode) {
      qb.andWhere('pub.periode = :periode', { periode });
    }

    if (classeFormation) {
      qb.andWhere('pub.classeFormation ILIKE :classeFormation', {
        classeFormation: buildIlikeTerm(classeFormation),
      });
    }

    if (type) {
      qb.andWhere('pub.type = :type', { type });
    }

    const orderField = sanitizeSortField(sortBy, SORT_FIELDS) ?? 'creeLe';
    qb.orderBy(`pub.${orderField}`, sortOrder === 'ASC' ? 'ASC' : 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return buildPaginatedData(items, total, page, limit);
  }

  async findPublicOne(id: number): Promise<ResultatPublication> {
    const publication = await this.publicationRepository.findOne({
      where: {
        id,
        statutPublication: ResultatPublicationStatus.PUBLIE,
      },
    });
    if (!publication) {
      throw new NotFoundException('Publication de résultat introuvable.');
    }
    return publication;
  }

  async findOne(id: number): Promise<ResultatPublication> {
    const publication = await this.publicationRepository.findOne({
      where: { id },
    });
    if (!publication) {
      throw new NotFoundException('Publication de résultat introuvable.');
    }
    return publication;
  }

  async findOneWithIndividuels(id: number): Promise<ResultatPublication> {
    const publication = await this.publicationRepository.findOne({
      where: { id },
      relations: { resultatsIndividuels: true },
    });
    if (!publication) {
      throw new NotFoundException('Publication de résultat introuvable.');
    }
    return publication;
  }

  async update(
    id: number,
    dto: UpdateResultatPublicationDto,
    userId: number,
    userName: string | null,
    ipAddress: string | null,
    endpoint: string,
  ): Promise<ResultatPublication> {
    const publication = await this.findOne(id);

    const previous = { ...publication };

    if (dto.titre !== undefined) publication.titre = dto.titre;
    if (dto.type !== undefined) publication.type = dto.type as ResultatPublicationType;
    if (dto.anneeScolaire !== undefined) publication.anneeScolaire = dto.anneeScolaire;
    if (dto.periode !== undefined) publication.periode = dto.periode;
    if (dto.classeFormation !== undefined) publication.classeFormation = dto.classeFormation;
    if (dto.modeConsultation !== undefined)
      publication.modeConsultation = dto.modeConsultation as ResultatConsultationMode;
    if (dto.modeConsultation !== undefined || dto.autorisePublicationPublique !== undefined) {
      publication.autorisePublicationPublique =
        publication.type === ResultatPublicationType.PDF &&
        (dto.autorisePublicationPublique === true ||
          publication.modeConsultation === ResultatConsultationMode.PUBLIC);
    }
    if (dto.statutPublication !== undefined)
      publication.statutPublication = dto.statutPublication as ResultatPublicationStatus;
    publication.misAJourPar = userId;

    const saved = await this.publicationRepository.save(publication);

    await this.logAction({
      userId,
      userName,
      action: 'modification',
      description: `Modification de la publication de résultat #${id}.`,
      method: 'PATCH',
      endpoint,
      statusCode: 200,
      success: true,
      ipAddress,
      metadata: { publicationId: id, previous, current: saved },
    });

    return saved;
  }

  async changerStatut(
    id: number,
    statut: ResultatPublicationStatus,
    userId: number,
    userName: string | null,
    ipAddress: string | null,
    endpoint: string,
    actionLabel: string,
  ): Promise<ResultatPublication> {
    const publication = await this.findOne(id);

    if (
      statut === ResultatPublicationStatus.PUBLIE &&
      publication.statutPublication === ResultatPublicationStatus.ARCHIVE
    ) {
      throw new ConflictException(
        'Une publication archivée ne peut pas être republiée directement.',
      );
    }

    publication.statutPublication = statut;
    publication.misAJourPar = userId;
    const saved = await this.publicationRepository.save(publication);

    await this.logAction({
      userId,
      userName,
      action: actionLabel,
      description: `Statut de la publication #${id} passé à « ${statut} ».`,
      method: 'POST',
      endpoint,
      statusCode: 200,
      success: true,
      ipAddress,
      metadata: { publicationId: id, statut },
    });

    return saved;
  }

  async getFichier(id: number): Promise<{
    buffer: Buffer;
    filename: string;
    mimetype: string;
    taille: number;
    inlineViewable: boolean;
  }> {
    const publication = await this.findOne(id);
    const buffer = await this.storageService.download(publication.objetChemin);
    const detected = detectFileType(buffer, publication.mimeType);
    return {
      buffer,
      filename: publication.fichierOriginal,
      mimetype: detected.mimetype,
      taille: publication.taille,
      inlineViewable: detected.inlineViewable,
    };
  }

  async getFichierPublic(id: number): Promise<{
    buffer: Buffer;
    filename: string;
    mimetype: string;
    taille: number;
    inlineViewable: boolean;
  } | null> {
    const publication = await this.publicationRepository.findOne({
      where: {
        id,
        statutPublication: ResultatPublicationStatus.PUBLIE,
        autorisePublicationPublique: true,
      },
    });
    if (!publication) return null;

    const buffer = await this.storageService.download(publication.objetChemin);
    const detected = detectFileType(buffer, publication.mimeType);
    return {
      buffer,
      filename: publication.fichierOriginal,
      mimetype: detected.mimetype,
      taille: publication.taille,
      inlineViewable: detected.inlineViewable,
    };
  }

  async remplacerFichier(
    id: number,
    file: Express.Multer.File,
    dto: { modeConsultation?: ResultatConsultationMode; autorisePublicationPublique?: boolean },
    userId: number,
    userName: string | null,
    ipAddress: string | null,
    endpoint: string,
  ): Promise<ResultatPublication> {
    const publication = await this.findOne(id);

    this.validateFile(file);

    const extensionMatch = /\.([^.]+)$/.exec(file.originalname);
    const extension = (extensionMatch?.[1] ?? '').toLowerCase();
    const isExcel = extension === 'xlsx' || extension === 'xls';
    const type = isExcel ? ResultatPublicationType.EXCEL : ResultatPublicationType.PDF;
    const privateObject =
      (dto.modeConsultation ?? publication.modeConsultation) === ResultatConsultationMode.PROTEGE;

    let stored: StorageUploadResult;
    try {
      stored = await this.storageService.upload(file.buffer, file.originalname, {
        mimetype: file.mimetype,
        prefix: STORAGE_PREFIXES.documents,
        privateObject,
        metadata: {
          'x-amz-meta-module': 'resultats',
          'x-amz-meta-type': type,
          'x-amz-meta-annee': publication.anneeScolaire,
        },
      });
    } catch (error) {
      this.logger.error(
        `Échec du stockage du fichier de remplacement (publication #${id})`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new ServiceUnavailableException(
        'Impossible d’enregistrer le fichier de remplacement. Le fichier original est conservé.',
      );
    }

    const ancienObjet = publication.objetChemin;

    publication.fichierOriginal = file.originalname;
    publication.objetChemin = stored.objectName;
    publication.mimeType = file.mimetype;
    publication.taille = file.buffer.length;
    publication.type = type;
    publication.modeConsultation = dto.modeConsultation ?? publication.modeConsultation;
    publication.autorisePublicationPublique =
      type === ResultatPublicationType.PDF &&
      (dto.autorisePublicationPublique === true ||
        publication.modeConsultation === ResultatConsultationMode.PUBLIC);
    publication.statutPublication = ResultatPublicationStatus.BROUILLON;
    publication.misAJourPar = userId;

    try {
      const saved = await this.publicationRepository.save(publication);
      await this.storageService.deleteStoredRef(ancienObjet);

      await this.logAction({
        userId,
        userName,
        action: 'remplacement_fichier',
        description: `Remplacement du fichier de la publication #${id} par "${file.originalname}".`,
        method: 'POST',
        endpoint,
        statusCode: 200,
        success: true,
        ipAddress,
        metadata: { publicationId: id, ancienObjet, nouveauObjet: stored.objectName },
      });

      return saved;
    } catch (error) {
      await this.storageService.deleteStoredRef(stored.objectName);
      this.logger.error(
        `Échec de l’enregistrement du remplacement (publication #${id})`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new ServiceUnavailableException(
        'Impossible d’enregistrer le remplacement en base. Le nouveau fichier a été retiré du stockage.',
      );
    }
  }

  async supprimer(
    id: number,
    userId: number,
    userName: string | null,
    ipAddress: string | null,
    endpoint: string,
  ): Promise<void> {
    const publication = await this.findOne(id);

    await this.publicationRepository.remove(publication);

    await this.storageService.deleteStoredRef(publication.objetChemin);

    await this.logAction({
      userId,
      userName,
      action: 'suppression',
      description: `Suppression de la publication de résultat #${id} (fichier "${publication.fichierOriginal}").`,
      method: 'DELETE',
      endpoint,
      statusCode: 200,
      success: true,
      ipAddress,
      metadata: { publicationId: id, fichier: publication.fichierOriginal },
    });
  }

  async listerIndividuels(
    publicationId: number,
    query: { page?: number; limit?: number; q?: string; statutAcademique?: string },
  ): Promise<PaginatedData<ResultatIndividuel>> {
    const { page = 1, limit = 50, q, statutAcademique } = query;

    const qb = this.individuelsRepository.createQueryBuilder('r');
    qb.andWhere('r.publicationId = :publicationId', { publicationId });

    if (q?.trim()) {
      const term = buildIlikeTerm(q);
      qb.andWhere(
        `(r.matricule ILIKE :term ${ILIKE_ESCAPE}
          OR r.nom ILIKE :term ${ILIKE_ESCAPE}
          OR r.prenom ILIKE :term ${ILIKE_ESCAPE})`,
        { term },
      );
    }

    if (statutAcademique) {
      qb.andWhere('r.statutAcademique = :statutAcademique', { statutAcademique });
    }

    qb.orderBy('r.matricule', 'ASC');
    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return buildPaginatedData(items, total, page, limit);
  }

  /**
   * Liste publique des résultats individuels d’une publication explicitement
   * diffusée en mode public. Aucun code de consultation n’est exposé.
   */
  async listerIndividuelsPublics(
    publicationId: number,
    query: { page?: number; limit?: number; q?: string; statutAcademique?: string },
  ): Promise<PaginatedData<Omit<ResultatIndividuel, 'codeConsultation'>>> {
    const publication = await this.publicationRepository.findOne({
      where: {
        id: publicationId,
        statutPublication: ResultatPublicationStatus.PUBLIE,
        modeConsultation: ResultatConsultationMode.PUBLIC,
      },
      select: ['id'],
    });
    if (!publication) {
      throw new NotFoundException(
        'Les résultats individuels de cette publication ne sont pas accessibles publiquement.',
      );
    }

    const result = await this.listerIndividuels(publicationId, query);
    return {
      items: result.items.map((item) => {
        const rest = { ...item };
        delete (rest as { codeConsultation?: string | null }).codeConsultation;
        return rest;
      }),
      meta: result.meta,
    };
  }

  async consulterIndividuel(
    matricule: string,
    code: string,
  ): Promise<{
    publication: ResultatPublication;
    individu: ResultatIndividuel;
  } | null> {
    const trimmedMatricule = matricule.trim();
    const individu = await this.individuelsRepository.findOne({
      where: {
        matricule: trimmedMatricule,
        codeConsultation: code,
      },
      relations: { publication: true },
    });
    if (!individu) return null;
    if (individu.publication.statutPublication !== ResultatPublicationStatus.PUBLIE) {
      return null;
    }
    return { publication: individu.publication, individu };
  }

  async getModeleImport(): Promise<{
    buffer: Buffer;
    filename: string;
    mimetype: string;
    taille: number;
  }> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ESSG';
    workbook.lastModifiedBy = 'ESSG';
    workbook.created = new Date();
    workbook.modified = new Date();

    const sheet = workbook.addWorksheet('Resultats');

    const headers = [
      { key: 'matricule', label: 'matricule', width: 20, required: true },
      { key: 'nom', label: 'nom', width: 20, required: true },
      { key: 'prenom', label: 'prenom', width: 20, required: true },
      { key: 'classe', label: 'classe', width: 15, required: false },
      { key: 'periode', label: 'periode', width: 15, required: false },
      { key: 'moyenne', label: 'moyenne', width: 12, required: false },
      { key: 'statutAcademique', label: 'statutAcademique', width: 20, required: false },
      { key: 'observation', label: 'observation', width: 40, required: false },
      { key: 'math', label: 'math', width: 10, required: false },
      { key: 'physique', label: 'physique', width: 10, required: false },
      { key: 'svt', label: 'svt', width: 10, required: false },
      { key: 'francais', label: 'francais', width: 10, required: false },
      { key: 'anglais', label: 'anglais', width: 10, required: false },
    ];

    const headerRow = sheet.getRow(1);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h.label;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: h.required ? 'FF1F4E79' : 'FF4B6A88' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
    headerRow.height = 22;

    headers.forEach((h, i) => {
      sheet.getColumn(i + 1).width = h.width;
    });

    // Seules les en-têtes sont présentes sur la feuille de saisie : aucune
    // ligne d’exemple ne risque d’être importée par erreur.
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = { from: 'A1', to: 'M1' };

    for (let rowNumber = 2; rowNumber <= 200; rowNumber++) {
      sheet.getCell(`G${rowNumber}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"admis,ajourne"'],
        showErrorMessage: true,
        errorTitle: 'Statut invalide',
        error: 'Choisissez « admis » ou « ajourne ».',
      };
    }

    const helpSheet = workbook.addWorksheet('Aide');
    helpSheet.columns = [{ width: 28 }, { width: 70 }];
    helpSheet.addRow(['Champ', 'Description']);
    helpSheet.addRow(['matricule (obligatoire)', 'Identifiant unique de l’étudiant.']);
    helpSheet.addRow(['nom (obligatoire)', 'Nom de famille de l’étudiant.']);
    helpSheet.addRow(['prenom (obligatoire)', 'Prénom de l’étudiant.']);
    helpSheet.addRow(['classe', 'Classe ou formation (facultatif).']);
    helpSheet.addRow(['periode', 'Semestre, session ou trimestre (facultatif).']);
    helpSheet.addRow(['moyenne', 'Moyenne générale numérique (facultatif).']);
    helpSheet.addRow([
      'statutAcademique',
      'Valeur attendue : « admis » ou « ajourne » (facultatif).',
    ]);
    helpSheet.addRow(['observation', 'Commentaire libre affiché avec le résultat (facultatif).']);
    helpSheet.addRow([
      'autres colonnes',
      'Toute colonne supplémentaire (math, physique, etc.) est enregistrée comme note de matière.',
    ]);
    helpSheet.addRow([
      'Diffusion',
      'Les résultats importés sont consultables directement sur le site public.',
    ]);

    const helpHeader = helpSheet.getRow(1);
    helpHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    helpHeader.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F4E79' },
    };
    helpSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.alignment = { vertical: 'top', wrapText: true };
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = 'modele-resultats.xlsx';
    const mimetype = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    return {
      buffer: Buffer.from(buffer),
      filename,
      mimetype,
      taille: Buffer.from(buffer).length,
    };
  }
}
