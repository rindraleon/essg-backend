import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedData } from '../common/interfaces/api-response.interface';
import { StorageService } from '../common/storage/storage.service';
import { ILIKE_ESCAPE, buildIlikeTerm, sanitizeSortField } from '../common/utils/search.util';
import { buildPaginatedData } from '../common/utils/pagination.util';
import { detectFileType, withDetectedExtension } from '../common/utils/file-type.util';
import { EmailDomainService } from '../common/validators/email-domain.service';
import { MailService } from '../mail/mail.service';
import { SettingsService } from '../settings/settings.service';
import { capitalize, toUpperCase } from '../common/utils/text.util';
import { CreateAdmissionDto } from './dto/create-admission.dto';
import { QueryAdmissionDto } from './dto/query-admission.dto';
import { UpdateAdmissionStatusDto } from './dto/update-admission-status.dto';
import { Admission, AdmissionStatus } from './entities/admission.entity';
import { AdmissionFile, AdmissionFileType } from './entities/admission-file.entity';

export type AdmissionDocumentKind = 'cv' | 'lettre';

export interface AdmissionDocumentFile {
  buffer: Buffer;
  filename: string;
  mimetype: string;
  inlineViewable: boolean;
}

export interface AdmissionUploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  objectPath: string;
}

export const ADMISSION_FILES_ACCEPTED_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
];

export const ADMISSION_FILE_MAX_SIZE = 10 * 1024 * 1024;

export const ADMISSION_FILE_LABELS: Record<AdmissionFileType, string> = {
  [AdmissionFileType.CV]: 'CV',
  [AdmissionFileType.LETTRE]: 'Lettre de motivation',
  [AdmissionFileType.RELEVE_BAC]: 'Relevé de notes du baccalauréat',
  [AdmissionFileType.ATTESTATION_BAC]: 'Attestation de réussite au baccalauréat',
  [AdmissionFileType.RELEVE_L3]: 'Relevé de notes L3',
  [AdmissionFileType.BORDEREAU]: 'Bordereau de versement',
};

export const ADMISSIONS_CLOSED_MESSAGE =
  'Les inscriptions sont actuellement fermées. Merci de consulter régulièrement notre site pour connaître la prochaine période d’admission.';

const ADMISSION_SORT_FIELDS = [
  'id',
  'nom',
  'prenom',
  'email',
  'telephone',
  'formation',
  'niveau',
  'statut',
  'creeLe',
  'misAJourLe',
] as const;

@Injectable()
export class AdmissionsService {
  private readonly logger = new Logger(AdmissionsService.name);

  constructor(
    @InjectRepository(Admission)
    private readonly admissionsRepository: Repository<Admission>,
    @InjectRepository(AdmissionFile)
    private readonly filesRepository: Repository<AdmissionFile>,
    private readonly mailService: MailService,
    private readonly storageService: StorageService,
    private readonly emailDomainService: EmailDomainService,
    private readonly settingsService: SettingsService,
  ) {}

  private async assertEmailDomainExists(email?: string): Promise<void> {
    if (!email) return;
    const result = await this.emailDomainService.check(email);
    if (result.reason) {
      throw new BadRequestException(result.reason);
    }
  }

  private async assertAdmissionsOpen(): Promise<void> {
    const settings = await this.settingsService.getPublic();
    if (!settings.admissionsOuvertes) {
      throw new ForbiddenException(ADMISSIONS_CLOSED_MESSAGE);
    }
  }

  private buildReference(id: number): string {
    return `ESSG-${id}`;
  }

  private normalizeOptional(value?: string): string | null {
    const trimmed = value?.trim();
    return trimmed || null;
  }

  private async assertNoDuplicate(
    numeroBaccalaureat?: string,
    numeroBordereau?: string,
    excludeId?: number,
  ): Promise<void> {
    const bac = this.normalizeOptional(numeroBaccalaureat);
    const bordereau = this.normalizeOptional(numeroBordereau);

    if (bac) {
      const found = await this.admissionsRepository.findOne({
        where: { numeroBaccalaureat: bac },
      });
      if (found && found.id !== excludeId) {
        throw new ConflictException('Ce numéro d’inscription au baccalauréat est déjà utilisé.');
      }
    }

    if (bordereau) {
      const found = await this.admissionsRepository.findOne({
        where: { numeroBordereau: bordereau },
      });
      if (found && found.id !== excludeId) {
        throw new ConflictException('Ce numéro de bordereau de versement est déjà utilisé.');
      }
    }
  }

  async checkDuplicate(dto: { numeroBaccalaureat?: string; numeroBordereau?: string }): Promise<{
    numeroBaccalaureatDisponible?: boolean;
    numeroBordereauDisponible?: boolean;
  }> {
    const result: {
      numeroBaccalaureatDisponible?: boolean;
      numeroBordereauDisponible?: boolean;
    } = {};

    const bac = this.normalizeOptional(dto.numeroBaccalaureat);
    if (bac) {
      const found = await this.admissionsRepository.findOne({
        where: { numeroBaccalaureat: bac },
      });
      result.numeroBaccalaureatDisponible = !found;
    }

    const bordereau = this.normalizeOptional(dto.numeroBordereau);
    if (bordereau) {
      const found = await this.admissionsRepository.findOne({
        where: { numeroBordereau: bordereau },
      });
      result.numeroBordereauDisponible = !found;
    }

    return result;
  }

  private validateFile(file: AdmissionUploadedFile | undefined, type: AdmissionFileType): void {
    if (!file) return;
    if (!ADMISSION_FILES_ACCEPTED_MIMES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Le fichier « ${ADMISSION_FILE_LABELS[type]} » doit être au format PDF ou image (JPG, PNG).`,
      );
    }
    if (file.buffer.length > ADMISSION_FILE_MAX_SIZE) {
      throw new BadRequestException(
        `Le fichier « ${ADMISSION_FILE_LABELS[type]} » dépasse la taille maximale de 10 Mo.`,
      );
    }
  }

  private validateRequiredFiles(
    niveau: string,
    files: Record<string, AdmissionUploadedFile>,
  ): void {
    const level = niveau.trim().toLowerCase();

    if (level === 'licence') {
      const hasBacProof = Boolean(files.releve_bac) || Boolean(files.attestation_bac);
      if (!hasBacProof) {
        throw new BadRequestException(
          'Le relevé de notes du baccalauréat ou l’attestation de réussite au baccalauréat est obligatoire.',
        );
      }
    }

    if (level === 'master') {
      if (!files.releve_l3) {
        throw new BadRequestException(
          'Le relevé de notes L3 est obligatoire pour une candidature en Master.',
        );
      }
    }

    if (!files.bordereau) {
      throw new BadRequestException(
        'La pièce justificative du bordereau de versement est obligatoire.',
      );
    }
  }

  private validateRequiredFields(niveau: string, dto: CreateAdmissionDto): void {
    const level = niveau.trim().toLowerCase();

    if (level === 'licence') {
      if (!this.normalizeOptional(dto.adresse)) {
        throw new BadRequestException(
          'L’adresse complète est obligatoire pour une candidature en Licence.',
        );
      }
      if (!this.normalizeOptional(dto.numeroBaccalaureat)) {
        throw new BadRequestException(
          'Le numéro d’inscription au baccalauréat est obligatoire pour une candidature en Licence.',
        );
      }
    }

    if (level === 'master') {
      if (!this.normalizeOptional(dto.adresse)) {
        throw new BadRequestException(
          'L’adresse complète est obligatoire pour une candidature en Master.',
        );
      }
      if (!this.normalizeOptional(dto.licenceEtablissement)) {
        throw new BadRequestException('L’établissement d’obtention de la Licence est obligatoire.');
      }
      if (!this.normalizeOptional(dto.licenceMention)) {
        throw new BadRequestException('La mention de la Licence est obligatoire.');
      }
    }

    if (!this.normalizeOptional(dto.numeroBordereau)) {
      throw new BadRequestException('Le numéro de bordereau de versement est obligatoire.');
    }
  }

  async create(
    createAdmissionDto: CreateAdmissionDto,
    uploadedFiles: Record<string, AdmissionUploadedFile> = {},
  ): Promise<Admission> {
    await this.assertAdmissionsOpen();
    await this.assertEmailDomainExists(createAdmissionDto.email);
    this.validateRequiredFields(createAdmissionDto.niveau, createAdmissionDto);
    await this.assertNoDuplicate(
      createAdmissionDto.numeroBaccalaureat,
      createAdmissionDto.numeroBordereau,
    );

    Object.entries(uploadedFiles).forEach(([key, file]) => {
      this.validateFile(file, key as AdmissionFileType);
    });
    this.validateRequiredFiles(createAdmissionDto.niveau, uploadedFiles);

    const admission = this.admissionsRepository.create({
      ...createAdmissionDto,
      nom: toUpperCase(createAdmissionDto.nom),
      prenom: capitalize(createAdmissionDto.prenom),
      formation: capitalize(createAdmissionDto.formation),
      diplomePrecedent: capitalize(createAdmissionDto.diplomePrecedent),
      niveau: capitalize(createAdmissionDto.niveau),
      adresse: createAdmissionDto.adresse ? capitalize(createAdmissionDto.adresse) : null,
      licenceEtablissement: createAdmissionDto.licenceEtablissement
        ? capitalize(createAdmissionDto.licenceEtablissement)
        : null,
      licenceMention: createAdmissionDto.licenceMention
        ? capitalize(createAdmissionDto.licenceMention)
        : null,
      numeroBaccalaureat: this.normalizeOptional(createAdmissionDto.numeroBaccalaureat),
      numeroBordereau: this.normalizeOptional(createAdmissionDto.numeroBordereau),
      statut: AdmissionStatus.EN_ATTENTE,
    });
    const saved = await this.admissionsRepository.save(admission);

    const fileRows = Object.entries(uploadedFiles).map(([key, file]) => {
      return this.filesRepository.create({
        admissionId: saved.id,
        type: key as AdmissionFileType,
        originalName: file.originalname,
        objectPath: file.objectPath,
        mimetype: file.mimetype,
        size: file.buffer.length,
      });
    });
    if (fileRows.length > 0) {
      await this.filesRepository.save(fileRows);
    }

    try {
      await this.mailService.sendAdmissionConfirmationEmail(
        saved.email,
        saved.nom,
        saved.prenom,
        saved.formation,
        this.buildReference(saved.id),
      );
      this.logger.log(`Accusé de réception envoyé à ${saved.email}`);
    } catch (error) {
      this.logger.error(`Échec de l'envoi de l'accusé de réception à ${saved.email}`, error);
    }

    try {
      await this.mailService.sendAdminsAdmissionNotification({
        nom: saved.nom,
        prenom: saved.prenom,
        email: saved.email,
        telephone: saved.telephone ?? undefined,
        niveau: saved.niveau,
        formation: saved.formation,
        numeroBaccalaureat: saved.numeroBaccalaureat ?? undefined,
        numeroBordereau: saved.numeroBordereau ?? undefined,
        reference: this.buildReference(saved.id),
        date: new Date().toISOString(),
        fileCount: fileRows.length,
      });
      this.logger.log('Notification administrateur envoyée pour la nouvelle admission');
    } catch (error) {
      this.logger.error(
        `Échec de la notification administrateur pour l'admission ${saved.id}`,
        error,
      );
    }

    return this.findOne(saved.id);
  }

  async findAll(query: QueryAdmissionDto = {}): Promise<PaginatedData<Admission>> {
    const {
      page = 1,
      limit = 10,
      sortBy,
      sortOrder = 'DESC',
      q,
      statut,
      niveau,
      formation,
      dateDebut,
    } = query;

    const qb = this.admissionsRepository.createQueryBuilder('admission');

    if (q?.trim()) {
      const term = buildIlikeTerm(q);
      qb.andWhere(
        `(admission.nom ILIKE :term ${ILIKE_ESCAPE}
          OR admission.prenom ILIKE :term ${ILIKE_ESCAPE}
          OR admission.email ILIKE :term ${ILIKE_ESCAPE}
          OR admission.telephone ILIKE :term ${ILIKE_ESCAPE}
          OR admission.formation ILIKE :term ${ILIKE_ESCAPE})`,
        { term },
      );
    }

    if (statut) {
      qb.andWhere('admission.statut = :statut', { statut });
    }

    if (niveau && niveau !== 'all') {
      qb.andWhere(`admission.niveau ILIKE :niveau ${ILIKE_ESCAPE}`, {
        niveau: buildIlikeTerm(niveau),
      });
    }

    if (formation && formation !== 'all') {
      qb.andWhere(`admission.formation ILIKE :formation ${ILIKE_ESCAPE}`, {
        formation: buildIlikeTerm(formation),
      });
    }

    if (dateDebut) {
      qb.andWhere('admission.creeLe >= :dateDebut', { dateDebut });
    }

    const orderField = sanitizeSortField(sortBy, ADMISSION_SORT_FIELDS) ?? 'creeLe';
    qb.orderBy(`admission.${orderField}`, sortOrder === 'ASC' ? 'ASC' : 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return buildPaginatedData(items, total, page, limit);
  }

  async findOne(id: number): Promise<Admission> {
    const admission = await this.admissionsRepository.findOne({
      where: { id },
      relations: { files: true },
    });
    if (!admission) {
      throw new NotFoundException(`Admission avec l'ID ${id} non trouvée`);
    }
    return admission;
  }

  async getFiles(id: number): Promise<AdmissionFile[]> {
    await this.findOne(id);
    return this.filesRepository.find({
      where: { admissionId: id },
      order: { creeLe: 'ASC' },
    });
  }

  async getFile(id: number, fileId: number): Promise<AdmissionDocumentFile> {
    const admission = await this.findOne(id);
    const file = await this.filesRepository.findOne({
      where: { id: fileId, admissionId: admission.id },
    });
    if (!file) {
      throw new NotFoundException('Fichier introuvable pour cette admission');
    }

    const buffer = await this.storageService.download(file.objectPath);
    const detected = detectFileType(buffer, file.mimetype);
    return {
      buffer,
      filename: withDetectedExtension(
        this.sanitizeBaseName(file.originalName, admission),
        detected.extension,
      ),
      mimetype: detected.mimetype,
      inlineViewable: detected.inlineViewable,
    };
  }

  async removeFile(id: number, fileId: number): Promise<void> {
    const admission = await this.findOne(id);
    const file = await this.filesRepository.findOne({
      where: { id: fileId, admissionId: admission.id },
    });
    if (!file) {
      throw new NotFoundException('Fichier introuvable pour cette admission');
    }
    await this.storageService.deleteStoredRef(file.objectPath);
    await this.filesRepository.delete(file.id);
  }

  async getDocument(id: number, kind: string): Promise<AdmissionDocumentFile> {
    if (kind !== 'cv' && kind !== 'lettre') {
      throw new BadRequestException('Type de document invalide');
    }

    const admission = await this.findOne(id);
    const type = kind === 'cv' ? AdmissionFileType.CV : AdmissionFileType.LETTRE;
    const file = await this.filesRepository.findOne({
      where: { admissionId: admission.id, type },
    });

    let objectPath: string | null | undefined;
    if (file) {
      objectPath = file.objectPath;
    } else {
      objectPath = kind === 'cv' ? admission.cvPath : admission.lettreMotivationPath;
    }
    if (!objectPath) {
      throw new NotFoundException('Document introuvable');
    }

    const objectName = this.storageService.extractObjectName(objectPath);
    const buffer = await this.storageService.download(objectName);
    const detected = detectFileType(buffer, file?.mimetype);
    let base: string;
    if (file?.originalName) {
      base = file.originalName.replace(/\.[^./\\]+$/, '');
    } else if (kind === 'cv') {
      base = `CV-${admission.nom}-${admission.prenom}`;
    } else {
      base = `Lettre-${admission.nom}-${admission.prenom}`;
    }

    return {
      buffer,
      filename: withDetectedExtension(base, detected.extension),
      mimetype: detected.mimetype,
      inlineViewable: detected.inlineViewable,
    };
  }

  private sanitizeBaseName(originalName: string, admission: Admission): string {
    const cleaned = originalName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w.-]+/g, '_')
      .slice(0, 100);
    return cleaned || `Document-${admission.nom}-${admission.prenom}`;
  }

  async updateStatus(id: number, updateStatusDto: UpdateAdmissionStatusDto): Promise<Admission> {
    const admission = await this.findOne(id);

    admission.statut = updateStatusDto.statut;
    if (updateStatusDto.commentaire !== undefined) {
      admission.commentaire = updateStatusDto.commentaire;
    }
    if (updateStatusDto.reponseDate !== undefined) {
      admission.reponseDate = updateStatusDto.reponseDate || null;
    }
    if (updateStatusDto.reponseHeure !== undefined) {
      admission.reponseHeure = updateStatusDto.reponseHeure || null;
    }
    if (updateStatusDto.reponseLieu !== undefined) {
      admission.reponseLieu = updateStatusDto.reponseLieu || null;
    }
    if (updateStatusDto.reponseInstructions !== undefined) {
      admission.reponseInstructions = updateStatusDto.reponseInstructions || null;
    }
    if (updateStatusDto.reponseMessage !== undefined) {
      admission.reponseMessage = updateStatusDto.reponseMessage || null;
    }

    const saved = await this.admissionsRepository.save(admission);
    await this.notifyStatusChange(saved);
    return saved;
  }

  private async notifyStatusChange(admission: Admission): Promise<void> {
    await this.mailService.sendAdmissionStatusEmail(admission.email, {
      nom: admission.nom,
      prenom: admission.prenom,
      formation: admission.formation,
      reference: this.buildReference(admission.id),
      statut: admission.statut,
      date: new Date().toLocaleDateString('fr-FR'),
      commentaire: admission.commentaire || undefined,
      reponseDate: admission.reponseDate || undefined,
      reponseHeure: admission.reponseHeure || undefined,
      reponseLieu: admission.reponseLieu || undefined,
      reponseInstructions: admission.reponseInstructions || undefined,
      reponseMessage: admission.reponseMessage || undefined,
    });
    this.logger.log(`Notification de statut envoyée à ${admission.email}`);
  }

  async remove(id: number): Promise<void> {
    const admission = await this.findOne(id);
    const files = admission.files ?? [];
    await this.admissionsRepository.remove(admission);
    await Promise.all(files.map((file) => this.storageService.deleteStoredRef(file.objectPath)));
    await Promise.all([
      this.storageService.deleteStoredRef(admission.cvPath),
      this.storageService.deleteStoredRef(admission.lettreMotivationPath),
    ]);
  }
}
