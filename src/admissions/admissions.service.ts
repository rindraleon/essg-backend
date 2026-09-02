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
import { EmailNotificationService } from '../infrastructure/email/email-notification.service';
import { SettingsService } from '../settings/settings.service';
import {
  normalizeEmail,
  normalizePhoneNumber,
  phoneComparisonKey,
} from '../common/utils/contact.util';
import { capitalize, capitalizeWords, toUpperCase } from '../common/utils/text.util';
import { isAdmissionProgramEligible, resolveBacCategory } from './admission-rules.constant';
import { CreateAdmissionDto } from './dto/create-admission.dto';
import { QueryAdmissionDto } from './dto/query-admission.dto';
import { UpdateAdmissionStatusDto } from './dto/update-admission-status.dto';
import { Admission, AdmissionStatus } from './entities/admission.entity';
import { AdmissionFile, AdmissionFileType } from './entities/admission-file.entity';

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
  [AdmissionFileType.DEMANDE_INSCRIPTION]: "Demande d'inscription",
  [AdmissionFileType.PHOTO_IDENTITE]: "Photo d'identité",
  [AdmissionFileType.ACTE_ETAT_CIVIL]: "Acte d'état civil",
  [AdmissionFileType.DIPLOME_BAC]: 'Diplôme du baccalauréat',
  [AdmissionFileType.ATTESTATION_ETABLISSEMENT]: "Attestation de l'ancien établissement",
};

export const ADMISSIONS_CLOSED_MESSAGE =
  'Les inscriptions sont actuellement fermées. Merci de consulter régulièrement notre site pour connaître la prochaine période d’admission.';

export function getCurrentAdmissionYear(): number {
  return new Date().getFullYear();
}

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
    private readonly emailNotifications: EmailNotificationService,
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

  private async assertNoDuplicate(numeroBordereau?: string, excludeId?: number): Promise<void> {
    const bordereau = this.normalizeOptional(numeroBordereau);

    if (bordereau) {
      const found = await this.admissionsRepository.findOne({
        where: { numeroBordereau: bordereau },
      });
      if (found && found.id !== excludeId) {
        throw new ConflictException('Ce numéro de bordereau de versement est déjà utilisé.');
      }
    }
  }

  async checkDuplicate(dto: {
    numeroBordereau?: string;
    email?: string;
    telephone?: string;
  }): Promise<{
    numeroBordereauDisponible?: boolean;
    emailDisponible?: boolean;
    telephoneDisponible?: boolean;
    annee?: number;
  }> {
    const result: {
      numeroBordereauDisponible?: boolean;
      emailDisponible?: boolean;
      telephoneDisponible?: boolean;
      annee?: number;
    } = {};

    const bordereau = this.normalizeOptional(dto.numeroBordereau);
    if (bordereau) {
      const found = await this.admissionsRepository.findOne({
        where: { numeroBordereau: bordereau },
      });
      result.numeroBordereauDisponible = !found;
    }

    const email = normalizeEmail(dto.email);
    const telephone = normalizePhoneNumber(dto.telephone);
    if (email || telephone) {
      const annee = getCurrentAdmissionYear();
      result.annee = annee;
      if (email) {
        const found = await this.admissionsRepository.findOne({
          where: { annee, email },
        });
        result.emailDisponible = !found;
      }
      const phoneKey = phoneComparisonKey(telephone);
      if (phoneKey) {
        // Comparaison sur les 9 derniers chiffres : cohérente entre les
        // anciens numéros stockés au format national (032…) et les nouveaux
        // au format international (+261…).
        const found = await this.admissionsRepository
          .createQueryBuilder('admission')
          .where('admission.annee = :annee', { annee })
          .andWhere('RIGHT(admission.telephone, 9) = :phoneKey', { phoneKey })
          .getOne();
        result.telephoneDisponible = !found;
      }
    }

    return result;
  }

  /**
   * Bloque une nouvelle candidature si l'email OU le téléphone a déjà été
   * utilisé pour une demande d'admission au cours de la même année.
   * Les deux vérifications sont indépendantes.
   */
  private async assertNoAnnualDuplicate(
    email: string,
    telephone?: string,
    annee = getCurrentAdmissionYear(),
    excludeId?: number,
  ): Promise<void> {
    const normalizedEmail = normalizeEmail(email);
    if (normalizedEmail) {
      const found = await this.admissionsRepository.findOne({
        where: { annee, email: normalizedEmail },
        select: ['id'],
      });
      if (found && found.id !== excludeId) {
        throw new ConflictException(
          `Une demande d'admission avec l'adresse email « ${normalizedEmail} » a déjà été déposée pour l'année ${annee}. Une seule candidature est autorisée par an.`,
        );
      }
    }

    const normalizedTelephone = normalizePhoneNumber(telephone);
    const phoneKey = phoneComparisonKey(normalizedTelephone);
    if (phoneKey) {
      // Comparaison sur les 9 derniers chiffres (formats national et
      // international confondus).
      const found = await this.admissionsRepository
        .createQueryBuilder('admission')
        .where('admission.annee = :annee', { annee })
        .andWhere('RIGHT(admission.telephone, 9) = :phoneKey', { phoneKey })
        .getOne();
      if (found && found.id !== excludeId) {
        throw new ConflictException(
          `Une demande d'admission avec le numéro de téléphone « ${normalizedTelephone} » a déjà été déposée pour l'année ${annee}. Une seule candidature est autorisée par an.`,
        );
      }
    }
  }

  /** Convertit une violation de contrainte d'unicité annuelle en erreur explicite. */
  private mapAnnualUniqueViolation(error: unknown, annee: number): void {
    const pgError = error as {
      code?: string;
      constraint?: string;
      driverError?: { code?: string };
    };
    const code = pgError?.code ?? pgError?.driverError?.code;
    if (code !== '23505') return;
    const constraint = pgError?.constraint ?? '';
    if (constraint === 'UQ_admissions_annee_email') {
      throw new ConflictException(
        `Une demande d'admission avec cette adresse email a déjà été déposée pour l'année ${annee}. Une seule candidature est autorisée par an.`,
      );
    }
    if (constraint === 'UQ_admissions_annee_telephone') {
      throw new ConflictException(
        `Une demande d'admission avec ce numéro de téléphone a déjà été déposée pour l'année ${annee}. Une seule candidature est autorisée par an.`,
      );
    }
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
    dto: CreateAdmissionDto,
    files: Record<string, AdmissionUploadedFile>,
  ): void {
    const common = [
      AdmissionFileType.DEMANDE_INSCRIPTION,
      AdmissionFileType.BORDEREAU,
      AdmissionFileType.PHOTO_IDENTITE,
      AdmissionFileType.ACTE_ETAT_CIVIL,
    ];
    for (const type of common) {
      if (!files[type]) {
        throw new BadRequestException(
          `La pièce « ${ADMISSION_FILE_LABELS[type]} » est obligatoire.`,
        );
      }
    }

    const currentYear = new Date().getFullYear();
    const bacYear = Number(dto.bacAnneeObtention);
    const bacProof =
      bacYear === currentYear ? AdmissionFileType.RELEVE_BAC : AdmissionFileType.DIPLOME_BAC;
    if (!files[bacProof]) {
      throw new BadRequestException(
        `La pièce « ${ADMISSION_FILE_LABELS[bacProof]} » est obligatoire.`,
      );
    }

    if (dto.niveau.trim().toLowerCase() === 'master' && !files.attestation_etablissement) {
      throw new BadRequestException(
        `La pièce « ${ADMISSION_FILE_LABELS[AdmissionFileType.ATTESTATION_ETABLISSEMENT]} » est obligatoire.`,
      );
    }
  }

  private validateRequiredFields(niveau: string, dto: CreateAdmissionDto): void {
    const required = [
      dto.telephone,
      dto.adresse,
      dto.lieuNaissance,
      dto.nationalite,
      dto.numeroBaccalaureat,
      dto.bacCentreExamen,
    ];
    if (required.some((value) => !this.normalizeOptional(value))) {
      throw new BadRequestException(
        'Toutes les informations personnelles et du baccalauréat sont obligatoires.',
      );
    }

    const detectedCategory = resolveBacCategory(dto.bacType, dto.bacSerie);
    if (!detectedCategory || detectedCategory !== dto.bacCategorie) {
      throw new BadRequestException(
        'Le type, la série et la catégorie du baccalauréat sont incohérents.',
      );
    }
    if (!isAdmissionProgramEligible(niveau, detectedCategory, dto.mention, dto.parcours)) {
      throw new BadRequestException(
        "La formation sélectionnée n'est pas compatible avec le profil du candidat.",
      );
    }

    if (niveau.trim().toLowerCase() === 'master') {
      if (
        !this.normalizeOptional(dto.ancienEtablissement) ||
        !this.normalizeOptional(dto.numeroMatricule)
      ) {
        throw new BadRequestException(
          "L'ancien établissement et le numéro matricule sont obligatoires en Master.",
        );
      }
    }
  }

  async create(
    createAdmissionDto: CreateAdmissionDto,
    uploadedFiles: Record<string, AdmissionUploadedFile> = {},
  ): Promise<Admission> {
    await this.assertAdmissionsOpen();
    await this.assertEmailDomainExists(createAdmissionDto.email);
    this.validateRequiredFields(createAdmissionDto.niveau, createAdmissionDto);
    await this.assertNoDuplicate(createAdmissionDto.numeroBordereau);

    // Une seule candidature par candidat et par année (email et téléphone vérifiés indépendamment).
    const annee = getCurrentAdmissionYear();
    await this.assertNoAnnualDuplicate(
      createAdmissionDto.email,
      createAdmissionDto.telephone,
      annee,
    );

    Object.entries(uploadedFiles).forEach(([key, file]) => {
      this.validateFile(file, key as AdmissionFileType);
    });
    this.validateRequiredFiles(createAdmissionDto, uploadedFiles);

    const admission = this.admissionsRepository.create({
      ...createAdmissionDto,
      nom: toUpperCase(createAdmissionDto.nom),
      prenom: capitalizeWords(createAdmissionDto.prenom ?? ''),
      email: normalizeEmail(createAdmissionDto.email) ?? createAdmissionDto.email.trim(),
      telephone: normalizePhoneNumber(createAdmissionDto.telephone),
      annee,
      formation: capitalize(createAdmissionDto.formation),
      diplomePrecedent: capitalize(createAdmissionDto.diplomePrecedent),
      niveau: capitalize(createAdmissionDto.niveau),
      lieuNaissance: capitalizeWords(createAdmissionDto.lieuNaissance),
      nationalite: capitalizeWords(createAdmissionDto.nationalite),
      adresse: capitalizeWords(createAdmissionDto.adresse),
      bacCentreExamen: capitalizeWords(createAdmissionDto.bacCentreExamen),
      ancienEtablissement: createAdmissionDto.ancienEtablissement
        ? capitalizeWords(createAdmissionDto.ancienEtablissement)
        : null,
      licenceEtablissement: createAdmissionDto.licenceEtablissement
        ? capitalizeWords(createAdmissionDto.licenceEtablissement)
        : null,
      licenceMention: createAdmissionDto.licenceMention
        ? capitalizeWords(createAdmissionDto.licenceMention)
        : null,
      numeroBaccalaureat: toUpperCase(createAdmissionDto.numeroBaccalaureat),
      numeroMatricule: createAdmissionDto.numeroMatricule
        ? toUpperCase(createAdmissionDto.numeroMatricule)
        : null,
      numeroBordereau: this.normalizeOptional(createAdmissionDto.numeroBordereau),
      statut: AdmissionStatus.EN_ATTENTE,
    });
    let saved: Admission;
    try {
      saved = await this.admissionsRepository.save(admission);
    } catch (error) {
      // Filet de sécurité contre les soumissions simultanées (la contrainte
      // d'unicité en base garantit l'intégrité même en cas de course).
      this.mapAnnualUniqueViolation(error, annee);
      throw error;
    }

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

    await this.emailNotifications.sendAdmissionConfirmation({
      email: saved.email,
      nom: saved.nom,
      prenom: saved.prenom,
      formation: saved.formation,
      reference: this.buildReference(saved.id),
      niveau: saved.niveau,
      mention: saved.mention ?? createAdmissionDto.mention,
      parcours: saved.parcours ?? createAdmissionDto.parcours,
      bacCategorie: saved.bacCategorie ?? createAdmissionDto.bacCategorie,
    });

    await this.emailNotifications.sendAdmissionAdminNotification({
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
      annee,
      dateDebut,
      dateFin,
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

    if (annee) {
      qb.andWhere('admission.annee = :annee', { annee });
    }

    if (dateDebut) {
      qb.andWhere('admission.creeLe >= :dateDebut', { dateDebut });
    }

    if (dateFin) {
      qb.andWhere('admission.creeLe <= :dateFin', { dateFin: `${dateFin}T23:59:59.999Z` });
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
    await this.emailNotifications.sendAdmissionStatus({
      email: admission.email,
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
