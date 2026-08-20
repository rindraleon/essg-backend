import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedData } from '../common/interfaces/api-response.interface';
import { StorageService } from '../common/storage/storage.service';
import { ILIKE_ESCAPE, buildIlikeTerm, sanitizeSortField } from '../common/utils/search.util';
import { buildPaginatedData } from '../common/utils/pagination.util';
import { detectFileType, withDetectedExtension } from '../common/utils/file-type.util';
import { EmailDomainService } from '../common/validators/email-domain.service';
import { MailService } from '../mail/mail.service';
import { capitalize, toUpperCase } from '../common/utils/text.util';
import { CreateAdmissionDto } from './dto/create-admission.dto';
import { QueryAdmissionDto } from './dto/query-admission.dto';
import { UpdateAdmissionStatusDto } from './dto/update-admission-status.dto';
import { Admission, AdmissionStatus } from './entities/admission.entity';

export type AdmissionDocumentKind = 'cv' | 'lettre';

export interface AdmissionDocumentFile {
  buffer: Buffer;
  filename: string;
  mimetype: string;
  inlineViewable: boolean;
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
    private readonly mailService: MailService,
    private readonly storageService: StorageService,
    private readonly emailDomainService: EmailDomainService,
  ) {}

  private async assertEmailDomainExists(email?: string): Promise<void> {
    if (!email) return;
    const result = await this.emailDomainService.check(email);
    if (result.reason) {
      throw new BadRequestException(result.reason);
    }
  }

  private buildReference(id: number): string {
    return `ESSG-${id}`;
  }

  async create(createAdmissionDto: CreateAdmissionDto): Promise<Admission> {
    await this.assertEmailDomainExists(createAdmissionDto.email);

    const admission = this.admissionsRepository.create({
      ...createAdmissionDto,
      nom: toUpperCase(createAdmissionDto.nom),
      prenom: capitalize(createAdmissionDto.prenom),
      formation: capitalize(createAdmissionDto.formation),
      diplomePrecedent: capitalize(createAdmissionDto.diplomePrecedent),
      niveau: capitalize(createAdmissionDto.niveau),
      statut: AdmissionStatus.EN_ATTENTE,
    });
    const saved = await this.admissionsRepository.save(admission);

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

    return saved;
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
    const admission = await this.admissionsRepository.findOne({ where: { id } });
    if (!admission) {
      throw new NotFoundException(`Admission avec l'ID ${id} non trouvée`);
    }
    return admission;
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

  async getDocument(id: number, kind: string): Promise<AdmissionDocumentFile> {
    if (kind !== 'cv' && kind !== 'lettre') {
      throw new BadRequestException('Type de document invalide');
    }

    const admission = await this.findOne(id);
    const storedUrl = kind === 'cv' ? admission.cvPath : admission.lettreMotivationPath;
    if (!storedUrl) {
      throw new NotFoundException('Document introuvable');
    }

    const objectName = this.storageService.extractObjectName(storedUrl);
    const buffer = await this.storageService.download(objectName);
    const detected = detectFileType(buffer);
    const base =
      kind === 'cv'
        ? `CV-${admission.nom}-${admission.prenom}`
        : `Lettre-${admission.nom}-${admission.prenom}`;

    return {
      buffer,
      filename: withDetectedExtension(base, detected.extension),
      mimetype: detected.mimetype,
      inlineViewable: detected.inlineViewable,
    };
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
    await this.admissionsRepository.remove(admission);
    await Promise.all([
      this.storageService.deleteStoredRef(admission.cvPath),
      this.storageService.deleteStoredRef(admission.lettreMotivationPath),
    ]);
  }
}
