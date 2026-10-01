import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Admission } from '../../entities/admission.entity';
import { AdmissionFile, AdmissionFileType } from '../../entities/admission-file.entity';
import { StorageService } from '../../../common/storage/storage.service';
import {
  AdmissionVerification,
  VerificationFieldResult,
  VerificationFieldStatus,
  VerificationGlobalStatus,
  VerificationDocumentInfo,
} from '../entities/admission-verification.entity';
import { TextExtractionService } from './text-extraction.service';
import {
  classifyDocuments,
  getBordereauFiles,
  getScolaireFiles,
} from '../utils/document-classifier.util';
import { compareNames, compareBacNumbers, compareCentres } from '../utils/similarity.util';
import { normalizeText, normalizeBordereau, normalizeCentre } from '../utils/normalization.util';
import { compareDates } from '../../../common/utils/french-date.util';
import { extractBordereauFull, verifyBordereauStrict } from '../utils/bordereau-extraction.util';
import { extractReleveNotes } from '../utils/releve-notes-extraction.util';

export interface VerificationContext {
  adminId?: number | null;
  adminEmail?: string | null;
}

const LABEL_DATE_NAISSANCE = 'Date de naissance';
const LABEL_LIEU_NAISSANCE = 'Lieu de naissance';
const LABEL_ANNEE_BAC = 'Année du bac';
const LABEL_CENTRE_EXAMEN = "Centre d'examen";
const LABEL_RELEVE_NOTES = 'Relevé de notes';
const EXPLICATION_DOC_ILLISIBLE = 'Lecture impossible : document illisible.';

interface ExtractionEntry {
  text: string;
  method: 'native' | 'ocr' | 'none';
  confidence: number;
  error?: string;
  fileId: number | null;
}

interface ExtractionState {
  byType: Record<string, ExtractionEntry>;
  documents: VerificationDocumentInfo[];
  texts: Record<string, unknown>;
  errors: string[];
}

function formatMoyenneSuffix(moyenneCalculee: number | null): string {
  return moyenneCalculee !== null ? `, moyenne ${moyenneCalculee}` : '';
}

@Injectable()
export class AdmissionDocumentVerificationService {
  private readonly logger = new Logger(AdmissionDocumentVerificationService.name);

  constructor(
    @InjectRepository(Admission)
    private readonly admissionsRepository: Repository<Admission>,
    @InjectRepository(AdmissionFile)
    private readonly filesRepository: Repository<AdmissionFile>,
    @InjectRepository(AdmissionVerification)
    private readonly verificationsRepository: Repository<AdmissionVerification>,
    private readonly storageService: StorageService,
    private readonly textExtraction: TextExtractionService,
  ) {}

  private async ensureVerificationsTable(): Promise<void> {
    try {
      await this.verificationsRepository.query(`
        CREATE TABLE IF NOT EXISTS "admission_verifications" (
          "id" SERIAL PRIMARY KEY,
          "admissionId" integer NOT NULL REFERENCES "admissions"("id") ON DELETE CASCADE,
          "adminId" integer,
          "adminEmail" varchar(255),
          "statut" varchar(30) NOT NULL,
          "score" integer NOT NULL DEFAULT 0,
          "resultats" jsonb NOT NULL DEFAULT '[]'::jsonb,
          "documentsAnalyses" jsonb NOT NULL DEFAULT '[]'::jsonb,
          "textesExtraits" jsonb NOT NULL DEFAULT '{}'::jsonb,
          "erreurs" jsonb,
          "dureeMs" integer,
          "creeLe" timestamptz DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS "IDX_VERIFICATION_ADMISSION" ON "admission_verifications" ("admissionId");
        CREATE INDEX IF NOT EXISTS "IDX_VERIFICATION_CREELE" ON "admission_verifications" ("creeLe");
      `);
    } catch (e) {
      this.logger.warn(
        `ensureVerificationsTable failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  async verify(admissionId: number, context: VerificationContext): Promise<AdmissionVerification> {
    return this.runVerification(admissionId, context);
  }

  /**
   * Executes the verification workflow. Kept separate from the public entry
   * point so the latter remains a simple orchestration method.
   */
  private async runVerification(
    admissionId: number,
    context: VerificationContext,
  ): Promise<AdmissionVerification> {
    await this.ensureVerificationsTable();
    const start = Date.now();
    const admission = await this.admissionsRepository.findOne({
      where: { id: admissionId },
      relations: { files: true },
    });
    if (!admission) {
      throw new NotFoundException(`Admission ${admissionId} non trouvée`);
    }

    const files = admission.files ?? [];
    const classified = classifyDocuments(files.map((f) => ({ id: f.id, type: f.type })));

    this.logger.log(
      `Vérification admission ${admissionId}: ${files.length} fichiers, ${classified.length} classés`,
    );

    const scolaireFiles = getScolaireFiles(classified);
    const bordereauFiles = getBordereauFiles(classified);

    const state: ExtractionState = {
      byType: {},
      documents: [],
      texts: {},
      errors: [],
    };

    // Extraction scolaire
    let combinedScolaireText = await this.extractScolaireDocuments(files, scolaireFiles, state);

    // Extraction bordereau
    let bordereauText = await this.extractBordereauDocuments(files, bordereauFiles, state);

    // Fallback scolaire si vide
    if (combinedScolaireText.trim().length === 0 && files.length > 0) {
      combinedScolaireText = Object.entries(state.byType)
        .filter(([k]) => (k as AdmissionFileType) !== AdmissionFileType.BORDEREAU)
        .map(([, v]) => v.text)
        .join('\n');
      if (!combinedScolaireText.trim()) {
        combinedScolaireText = await this.extractRemainingFiles(files, state);
      }
    }

    // Fallback bordereau
    const bordereauFileEntities = files.filter((f) => f.type === AdmissionFileType.BORDEREAU);
    if (!bordereauText.trim() && bordereauFileEntities.length > 0 && !bordereauFiles.length) {
      bordereauText = await this.extractBordereauFallback(bordereauFileEntities, state);
    }

    // Récupération des bordereaux existants pour vérification d'unicité (hors admission courante)
    const existingBordereaux = await this.loadExistingBordereaux(
      admissionId,
      admission.numeroBordereau,
    );

    const results: VerificationFieldResult[] = [
      // 1. Identité
      this.verifyNom(admission.nom, combinedScolaireText),
      this.verifyPrenom(admission.prenom, combinedScolaireText),

      // 2. Infos personnelles supplémentaires
      this.verifyDateNaissance(admission.dateNaissance, combinedScolaireText),
      this.verifyLieuNaissance(admission.lieuNaissance, combinedScolaireText),

      // 3. BAC
      this.verifyNumeroBac(admission.numeroBaccalaureat, combinedScolaireText),
      this.verifyBacAnnee(admission.bacAnneeObtention, combinedScolaireText),
      this.verifyCentre(admission.bacCentreExamen, combinedScolaireText),

      // 4. Bordereau — vérification stricte + unicité + extraction complète
      this.verifyBordereauStrict(
        admission.numeroBordereau,
        bordereauText || combinedScolaireText,
        existingBordereaux,
      ),

      // 5. Relevé de notes — extraction complète multi-pages
      this.verifyReleveNotes(combinedScolaireText),
    ];

    const { score, statut } = this.computeGlobal(results, state.documents);

    const dureeMs = Date.now() - start;

    this.buildMetaExtras(state.texts, combinedScolaireText, bordereauText || combinedScolaireText);

    const verification = this.verificationsRepository.create({
      admissionId: admission.id,
      adminId: context.adminId ?? null,
      adminEmail: context.adminEmail ?? null,
      statut,
      score,
      resultats: results,
      documentsAnalyses: state.documents,
      textesExtraits: state.texts,
      erreurs: state.errors.length > 0 ? state.errors : null,
      dureeMs,
    });

    let saved: AdmissionVerification;
    try {
      saved = await this.verificationsRepository.save(verification);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      const code = (error as { code?: string })?.code;
      const isMissingTable =
        code === '42P01' ||
        (msg.includes('admission_verifications') &&
          (msg.includes("n'existe pas") || msg.includes('does not exist')));
      if (isMissingTable) {
        this.logger.warn('Table admission_verifications manquante, création automatique...');
        await this.ensureVerificationsTable();
        saved = await this.verificationsRepository.save(verification);
      } else {
        throw error;
      }
    }
    this.logger.log(
      `Vérification ${saved.id} admission ${admissionId}: ${statut} ${score}% ${dureeMs}ms`,
    );
    return saved;
  }

  private async extractAndRecord(
    fileEntity: AdmissionFile,
    type: string,
    state: ExtractionState,
  ): Promise<ExtractionEntry> {
    const buffer = await this.storageService.download(fileEntity.objectPath);
    const result = await this.textExtraction.extractText(
      buffer,
      fileEntity.mimetype,
      fileEntity.originalName,
    );
    const entry: ExtractionEntry = {
      text: result.text,
      method: result.method,
      confidence: result.confidence,
      error: result.error,
      fileId: fileEntity.id,
    };
    state.byType[type] = entry;
    state.texts[type] = result.text.slice(0, 8000);
    state.documents.push({
      fileId: fileEntity.id,
      type,
      originalName: fileEntity.originalName,
      mimetype: fileEntity.mimetype,
      methode: result.method,
      taille: fileEntity.size,
      texteExtraitLongueur: result.text.length,
      confianceExtraction: result.confidence,
      erreur: result.error || null,
    });
    if (result.error) state.errors.push(`[${type}] ${result.error}`);
    return entry;
  }

  private async extractScolaireDocuments(
    files: AdmissionFile[],
    scolaireFiles: Array<{ fileId: number; type: string }>,
    state: ExtractionState,
  ): Promise<string> {
    let combinedText = '';
    for (const cf of scolaireFiles) {
      const fileEntity = files.find((f) => f.id === cf.fileId);
      if (!fileEntity) continue;
      try {
        const result = await this.extractAndRecord(fileEntity, cf.type, state);
        combinedText += '\n' + result.text;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`Impossible de lire fichier ${fileEntity.id}: ${msg}`);
        state.errors.push(`Fichier ${cf.type} illisible: ${msg}`);
        state.documents.push({
          fileId: fileEntity.id,
          type: cf.type,
          originalName: fileEntity.originalName,
          mimetype: fileEntity.mimetype,
          methode: 'none',
          taille: fileEntity.size,
          texteExtraitLongueur: 0,
          erreur: msg,
        });
        state.byType[cf.type] = {
          text: '',
          method: 'none',
          confidence: 0,
          error: msg,
          fileId: fileEntity.id,
        };
      }
    }
    return combinedText;
  }

  private async extractBordereauDocuments(
    files: AdmissionFile[],
    bordereauFiles: Array<{ fileId: number; type: string }>,
    state: ExtractionState,
  ): Promise<string> {
    let bordereauText = '';
    for (const cf of bordereauFiles) {
      const fileEntity = files.find((f) => f.id === cf.fileId);
      if (!fileEntity) continue;
      const existing = state.byType[cf.type];
      if (existing) {
        bordereauText = existing.text;
        continue;
      }
      try {
        const result = await this.extractAndRecord(fileEntity, cf.type, state);
        bordereauText += '\n' + result.text;
      } catch (e) {
        this.logger.warn(
          'Échec dans extractBordereauDocuments — poursuite en mode dégradé',
          e instanceof Error ? e.message : e,
        );
        const msg = e instanceof Error ? e.message : String(e);
        state.errors.push(`Bordereau illisible: ${msg}`);
        state.documents.push({
          fileId: fileEntity.id,
          type: cf.type,
          originalName: fileEntity.originalName,
          mimetype: fileEntity.mimetype,
          methode: 'none',
          taille: fileEntity.size,
          texteExtraitLongueur: 0,
          erreur: msg,
        });
      }
    }
    return bordereauText;
  }

  private async extractRemainingFiles(
    files: AdmissionFile[],
    state: ExtractionState,
  ): Promise<string> {
    let combinedText = '';
    for (const f of files) {
      if (state.byType[f.type]) continue;
      try {
        const result = await this.extractAndRecord(f, f.type, state);
        combinedText += '\n' + result.text;
      } catch (e) {
        this.logger.warn(
          'Échec dans extractRemainingFiles — poursuite en mode dégradé',
          e instanceof Error ? e.message : e,
        );
        const msg = e instanceof Error ? e.message : String(e);
        state.errors.push(`Fichier ${f.type} illisible: ${msg}`);
      }
    }
    return combinedText;
  }

  private async extractBordereauFallback(
    bordereauFileEntities: AdmissionFile[],
    state: ExtractionState,
  ): Promise<string> {
    let bordereauText = '';
    for (const f of bordereauFileEntities) {
      const existing = state.byType[f.type];
      if (existing) {
        bordereauText = existing.text;
        break;
      }
      try {
        const buffer = await this.storageService.download(f.objectPath);
        const result = await this.textExtraction.extractText(buffer, f.mimetype, f.originalName);
        state.texts[f.type] = result.text.slice(0, 8000);
        bordereauText = result.text;
        state.documents.push({
          fileId: f.id,
          type: f.type,
          originalName: f.originalName,
          mimetype: f.mimetype,
          methode: result.method,
          taille: f.size,
          texteExtraitLongueur: result.text.length,
          confianceExtraction: result.confidence,
          erreur: result.error || null,
        });
      } catch (e) {
        this.logger.warn(
          'Échec dans extractBordereauFallback — poursuite en mode dégradé',
          e instanceof Error ? e.message : e,
        );
        const msg = e instanceof Error ? e.message : String(e);
        state.errors.push(`Bordereau illisible: ${msg}`);
      }
    }
    return bordereauText;
  }

  private async loadExistingBordereaux(
    admissionId: number,
    numeroBordereau: string | null | undefined,
  ): Promise<string[]> {
    if (!numeroBordereau) return [];
    try {
      const all = await this.admissionsRepository
        .createQueryBuilder('a')
        .select('a.numeroBordereau')
        .where('a.id != :id', { id: admissionId })
        .andWhere('a.numeroBordereau IS NOT NULL')
        .getMany();
      return all.map((a) => a.numeroBordereau).filter(Boolean) as string[];
    } catch (error) {
      this.logger.warn(
        'Échec dans loadExistingBordereaux — poursuite en mode dégradé',
        error instanceof Error ? error.message : error,
      );
      // si échec requête, on continue sans unicité
      return [];
    }
  }

  private buildMetaExtras(
    texts: Record<string, unknown>,
    combinedScolaireText: string,
    bordereauSourceText: string,
  ): void {
    try {
      const releve = extractReleveNotes(combinedScolaireText);
      const bordereauFull = extractBordereauFull(bordereauSourceText);
      texts['_meta_releve'] = {
        matieres: releve.matieres,
        moyenneCalculee: releve.moyenneCalculee,
        moyenneExtraite: releve.moyenneExtraite,
        warnings: releve.warnings,
        total: releve.totalMatieres,
        estimatedPages: releve.estimatedPages,
      };
      texts['_meta_bordereau'] = {
        allNumbers: bordereauFull.allNumbers.slice(0, 20),
        allAlphanumerics: bordereauFull.allAlphanumerics.slice(0, 20),
        bordereauNumber: bordereauFull.bordereauNumber,
        referenceField: bordereauFull.referenceField,
        detectedModel: bordereauFull.detectedModel,
        dates: bordereauFull.dates,
        montants: bordereauFull.montants,
      };
    } catch (error: unknown) {
      this.logger.warn(
        'Constitution des métadonnées de bordereau ignorée (meta optionnel)',
        error instanceof Error ? error.message : error,
      );
    }
  }

  private verifyNom(nomSaisi: string | null, texte: string): VerificationFieldResult {
    const valeurSaisie = nomSaisi?.trim() || null;
    if (!valeurSaisie) {
      return {
        champ: 'nom',
        label: 'Nom',
        valeurSaisie: null,
        valeurExtraite: null,
        statut: VerificationFieldStatus.NON_DETECTE,
        score: 0,
        confiance: 0,
        explication: 'Aucun nom saisi à vérifier.',
      };
    }
    if (!texte || texte.trim().length < 10) {
      return {
        champ: 'nom',
        label: 'Nom',
        valeurSaisie: valeurSaisie.toUpperCase(),
        valeurExtraite: null,
        statut: VerificationFieldStatus.NON_DETECTE,
        score: 0,
        confiance: 0,
        explication: 'Lecture impossible : document illisible ou aucun texte extrait.',
        details: { raison: 'texte vide', lecture: 'impossible' },
      };
    }

    const match = compareNames(valeurSaisie, texte);
    const normSaisie = normalizeText(valeurSaisie);
    const detected = match.detected ? normalizeText(match.detected) : null;

    if (match.isExact && match.confidence >= 0.9) {
      return {
        champ: 'nom',
        label: 'Nom',
        valeurSaisie: normSaisie,
        valeurExtraite: detected,
        statut: VerificationFieldStatus.CONFORME,
        score: 100,
        confiance: match.confidence,
        explication:
          'Vérifié : nom retrouvé exactement dans le document (ordre indifférent, accents ignorés).',
      };
    }
    if (match.similarity >= 0.85) {
      return {
        champ: 'nom',
        label: 'Nom',
        valeurSaisie: normSaisie,
        valeurExtraite: detected,
        statut: VerificationFieldStatus.A_VERIFIER,
        score: Math.round(match.similarity * 100),
        confiance: match.confidence,
        explication:
          'À vérifier : nom probablement correspondant mais incertitude OCR (similarité élevée).',
        details: { similarity: match.similarity },
      };
    }
    if (match.isPartial && match.similarity >= 0.55) {
      return {
        champ: 'nom',
        label: 'Nom',
        valeurSaisie: normSaisie,
        valeurExtraite: detected,
        statut: VerificationFieldStatus.A_VERIFIER,
        score: Math.round(match.similarity * 100),
        confiance: 0.6,
        explication: 'À vérifier : correspondance partielle — une partie du nom a été retrouvée.',
        details: { tokenSimilarity: match.tokenSimilarity },
      };
    }
    if (match.similarity > 0.4) {
      return {
        champ: 'nom',
        label: 'Nom',
        valeurSaisie: normSaisie,
        valeurExtraite: detected,
        statut: VerificationFieldStatus.NON_CONFORME,
        score: Math.round(match.similarity * 30),
        confiance: 0.7,
        explication: 'Incohérent : nom différent de celui détecté dans le document.',
        details: { similarity: match.similarity },
      };
    }
    return {
      champ: 'nom',
      label: 'Nom',
      valeurSaisie: normSaisie,
      valeurExtraite: detected || '—',
      statut: VerificationFieldStatus.NON_DETECTE,
      score: 0,
      confiance: 0.2,
      explication: 'Non trouvé : aucun nom exploitable dans les documents scolaires.',
    };
  }

  private verifyPrenom(prenomSaisi: string | null, texte: string): VerificationFieldResult {
    const valeurSaisie = prenomSaisi?.trim() || null;
    if (!valeurSaisie) {
      return {
        champ: 'prenom',
        label: 'Prénom',
        valeurSaisie: null,
        valeurExtraite: null,
        statut: VerificationFieldStatus.NON_DETECTE,
        score: 0,
        confiance: 0,
        explication: 'Aucun prénom saisi à vérifier.',
      };
    }
    if (!texte || texte.trim().length < 10) {
      return {
        champ: 'prenom',
        label: 'Prénom',
        valeurSaisie: normalizeText(valeurSaisie),
        valeurExtraite: null,
        statut: VerificationFieldStatus.NON_DETECTE,
        score: 0,
        confiance: 0,
        explication: EXPLICATION_DOC_ILLISIBLE,
      };
    }
    const normSaisie = normalizeText(valeurSaisie);
    const saisieTokens = normSaisie.split(' ').filter(Boolean);
    const match = compareNames(valeurSaisie, texte);
    const detected = match.detected ? normalizeText(match.detected) : null;

    const textTokens = new Set(normalizeText(texte).split(' ').filter(Boolean));
    const matchedTokens = saisieTokens.filter((t) => textTokens.has(t));
    const allMatched = matchedTokens.length === saisieTokens.length;
    const partialMatched = matchedTokens.length > 0 && matchedTokens.length < saisieTokens.length;

    if (match.isExact && allMatched) {
      return {
        champ: 'prenom',
        label: 'Prénom',
        valeurSaisie: normSaisie,
        valeurExtraite: detected,
        statut: VerificationFieldStatus.CONFORME,
        score: 100,
        confiance: 0.97,
        explication: 'Vérifié : prénom retrouvé dans le document.',
      };
    }
    if (partialMatched) {
      return {
        champ: 'prenom',
        label: 'Prénom',
        valeurSaisie: normSaisie,
        valeurExtraite: matchedTokens.join(' ') || detected,
        statut: VerificationFieldStatus.A_VERIFIER,
        score: Math.round((matchedTokens.length / saisieTokens.length) * 70 + 10),
        confiance: 0.65,
        explication: `À vérifier : correspondance partielle ${matchedTokens.length}/${saisieTokens.length} partie(s) retrouvée(s) — saisi « ${normSaisie} » ↔ détecté « ${matchedTokens.join(' ')} ».`,
        details: { matchedTokens, saisieTokens },
      };
    }
    if (match.similarity >= 0.8) {
      return {
        champ: 'prenom',
        label: 'Prénom',
        valeurSaisie: normSaisie,
        valeurExtraite: detected,
        statut: VerificationFieldStatus.A_VERIFIER,
        score: Math.round(match.similarity * 100),
        confiance: match.confidence,
        explication: 'À vérifier : prénom probablement correspondant (incertitude OCR).',
      };
    }
    if (match.similarity >= 0.5) {
      return {
        champ: 'prenom',
        label: 'Prénom',
        valeurSaisie: normSaisie,
        valeurExtraite: detected,
        statut: VerificationFieldStatus.NON_CONFORME,
        score: 20,
        confiance: 0.7,
        explication: 'Incohérent : prénom différent de celui détecté.',
      };
    }
    return {
      champ: 'prenom',
      label: 'Prénom',
      valeurSaisie: normSaisie,
      valeurExtraite: detected || '—',
      statut: VerificationFieldStatus.NON_DETECTE,
      score: 0,
      confiance: 0.2,
      explication: 'Non trouvé : aucun prénom exploitable.',
    };
  }

  private verifyDateNaissance(dateSaisie: string | null, texte: string): VerificationFieldResult {
    const valeurSaisie = dateSaisie?.trim() || null;
    if (!valeurSaisie) {
      return {
        champ: 'dateNaissance',
        label: LABEL_DATE_NAISSANCE,
        valeurSaisie: null,
        valeurExtraite: null,
        statut: VerificationFieldStatus.NON_DETECTE,
        score: 0,
        confiance: 0,
        explication: 'Aucune date de naissance saisie.',
      };
    }
    if (!texte || texte.trim().length < 10) {
      return {
        champ: 'dateNaissance',
        label: LABEL_DATE_NAISSANCE,
        valeurSaisie: valeurSaisie,
        valeurExtraite: null,
        statut: VerificationFieldStatus.NON_DETECTE,
        score: 0,
        confiance: 0,
        explication: EXPLICATION_DOC_ILLISIBLE,
      };
    }
    const cmp = compareDates(valeurSaisie, texte);
    if (cmp.status === 'conforme') {
      return {
        champ: 'dateNaissance',
        label: LABEL_DATE_NAISSANCE,
        valeurSaisie: cmp.normalizedExpected || valeurSaisie,
        valeurExtraite: cmp.detected,
        statut: VerificationFieldStatus.CONFORME,
        score: 100,
        confiance: cmp.confidence,
        explication: `Vérifié : date retrouvée exactement (${cmp.detected}). Saisie ${cmp.normalizedExpected} ↔ Détectée ${cmp.normalizedDetected}.`,
        details: {
          normalizedExpected: cmp.normalizedExpected,
          normalizedDetected: cmp.normalizedDetected,
        },
      };
    }
    if (cmp.status === 'non_detecte') {
      return {
        champ: 'dateNaissance',
        label: LABEL_DATE_NAISSANCE,
        valeurSaisie: cmp.normalizedExpected || valeurSaisie,
        valeurExtraite: null,
        statut: VerificationFieldStatus.NON_DETECTE,
        score: 0,
        confiance: cmp.confidence,
        explication: `Non trouvé : aucune date exploitable dans le document. Saisie ${cmp.normalizedExpected || valeurSaisie} non retrouvée.`,
        details: { normalizedExpected: cmp.normalizedExpected },
      };
    }
    return {
      champ: 'dateNaissance',
      label: LABEL_DATE_NAISSANCE,
      valeurSaisie: cmp.normalizedExpected || valeurSaisie,
      valeurExtraite: cmp.detected,
      statut: VerificationFieldStatus.NON_CONFORME,
      score: 0,
      confiance: cmp.confidence,
      explication: `Incohérent : saisie ${cmp.normalizedExpected || valeurSaisie} ≠ détectée ${cmp.detected || '—'} (${cmp.normalizedDetected || 'non parsée'}).`,
      details: {
        normalizedExpected: cmp.normalizedExpected,
        normalizedDetected: cmp.normalizedDetected,
        similarity: cmp.similarity,
      },
    };
  }

  private verifyLieuNaissance(lieuSaisi: string | null, texte: string): VerificationFieldResult {
    const valeurSaisie = lieuSaisi?.trim() || null;
    if (!valeurSaisie) {
      return {
        champ: 'lieuNaissance',
        label: LABEL_LIEU_NAISSANCE,
        valeurSaisie: null,
        valeurExtraite: null,
        statut: VerificationFieldStatus.NON_DETECTE,
        score: 0,
        confiance: 0,
        explication: 'Aucun lieu de naissance saisi.',
      };
    }
    if (!texte || texte.trim().length < 10) {
      return {
        champ: 'lieuNaissance',
        label: LABEL_LIEU_NAISSANCE,
        valeurSaisie: normalizeCentre(valeurSaisie),
        valeurExtraite: null,
        statut: VerificationFieldStatus.NON_DETECTE,
        score: 0,
        confiance: 0,
        explication: EXPLICATION_DOC_ILLISIBLE,
      };
    }
    const cmp = compareCentres(valeurSaisie, texte);
    const normSaisie = normalizeCentre(valeurSaisie);
    const normExtrait = cmp.detectedSnippet ? normalizeCentre(cmp.detectedSnippet) : null;
    // Tolérance casse/accents/espaces déjà gérée par normalizeCentre + compareCentres
    if (cmp.similarity >= 0.92) {
      return {
        champ: 'lieuNaissance',
        label: LABEL_LIEU_NAISSANCE,
        valeurSaisie: normSaisie,
        valeurExtraite: normExtrait,
        statut: VerificationFieldStatus.CONFORME,
        score: 100,
        confiance: cmp.confidence,
        explication: 'Vérifié : lieu retrouvé (tolérance casse/accents/espaces).',
        details: { similarity: cmp.similarity },
      };
    }
    if (cmp.similarity >= 0.65) {
      return {
        champ: 'lieuNaissance',
        label: LABEL_LIEU_NAISSANCE,
        valeurSaisie: normSaisie,
        valeurExtraite: normExtrait,
        statut: VerificationFieldStatus.A_VERIFIER,
        score: Math.round(cmp.similarity * 100),
        confiance: cmp.confidence,
        explication:
          'À vérifier : lieu probablement correspondant mais variante d’écriture ou OCR incertain.',
        details: { similarity: cmp.similarity },
      };
    }
    if (cmp.similarity >= 0.35) {
      return {
        champ: 'lieuNaissance',
        label: LABEL_LIEU_NAISSANCE,
        valeurSaisie: normSaisie,
        valeurExtraite: normExtrait,
        statut: VerificationFieldStatus.NON_CONFORME,
        score: Math.round(cmp.similarity * 40),
        confiance: 0.65,
        explication: 'Incohérent : lieu différent de celui détecté.',
        details: { similarity: cmp.similarity },
      };
    }
    return {
      champ: 'lieuNaissance',
      label: LABEL_LIEU_NAISSANCE,
      valeurSaisie: normSaisie,
      valeurExtraite: normExtrait || '—',
      statut: VerificationFieldStatus.NON_DETECTE,
      score: 0,
      confiance: 0.2,
      explication: 'Non trouvé : aucun lieu exploitable dans les documents.',
      details: { similarity: cmp.similarity },
    };
  }

  private verifyNumeroBac(numeroSaisi: string | null, texte: string): VerificationFieldResult {
    const valeurSaisie = numeroSaisi?.trim() || null;
    if (!valeurSaisie) {
      return {
        champ: 'numeroBac',
        label: 'Numéro du bac',
        valeurSaisie: null,
        valeurExtraite: null,
        statut: VerificationFieldStatus.NON_DETECTE,
        score: 0,
        confiance: 0,
        explication: 'Aucun numéro de bac saisi.',
      };
    }
    if (!texte || texte.trim().length < 10) {
      return {
        champ: 'numeroBac',
        label: 'Numéro du bac',
        valeurSaisie: valeurSaisie.toUpperCase(),
        valeurExtraite: null,
        statut: VerificationFieldStatus.NON_DETECTE,
        score: 0,
        confiance: 0,
        explication: EXPLICATION_DOC_ILLISIBLE,
      };
    }
    const cmp = compareBacNumbers(valeurSaisie, texte);
    const map: Record<
      string,
      { statut: VerificationFieldStatus; score: number; explication: string }
    > = {
      conforme: {
        statut: VerificationFieldStatus.CONFORME,
        score: 100,
        explication: 'Vérifié : numéro du bac retrouvé exactement.',
      },
      a_verifier: {
        statut: VerificationFieldStatus.A_VERIFIER,
        score: 60,
        explication:
          'À vérifier : numéro probablement correspondant mais incertitude OCR (1-2 caractères).',
      },
      non_conforme: {
        statut: VerificationFieldStatus.NON_CONFORME,
        score: 0,
        explication: `Incohérent : numéro trouvé (${cmp.detected}) ≠ saisi (${valeurSaisie}).`,
      },
      non_detecte: {
        statut: VerificationFieldStatus.NON_DETECTE,
        score: 0,
        explication: 'Non trouvé : aucun numéro exploitable dans le document.',
      },
    };
    const mapped = map[cmp.status];
    return {
      champ: 'numeroBac',
      label: 'Numéro du bac',
      valeurSaisie: valeurSaisie.toUpperCase(),
      valeurExtraite: cmp.detected,
      statut: mapped.statut,
      score: mapped.score,
      confiance: cmp.confidence,
      explication: mapped.explication,
      details: { similarity: cmp.similarity },
    };
  }

  private verifyBacAnnee(anneeSaisie: string | null, texte: string): VerificationFieldResult {
    const valeurSaisie = anneeSaisie?.trim() || null;
    if (!valeurSaisie) {
      return {
        champ: 'bacAnnee',
        label: LABEL_ANNEE_BAC,
        valeurSaisie: null,
        valeurExtraite: null,
        statut: VerificationFieldStatus.NON_DETECTE,
        score: 0,
        confiance: 0,
        explication: 'Aucune année du bac saisie.',
      };
    }
    // Validation 4 chiffres
    const cleanedYear = valeurSaisie.replace(/\D/g, '').slice(0, 4);
    if (
      !/^\d{4}$/.test(cleanedYear) ||
      Number.parseInt(cleanedYear, 10) < 1900 ||
      Number.parseInt(cleanedYear, 10) > 2100
    ) {
      return {
        champ: 'bacAnnee',
        label: LABEL_ANNEE_BAC,
        valeurSaisie: valeurSaisie,
        valeurExtraite: null,
        statut: VerificationFieldStatus.NON_CONFORME,
        score: 0,
        confiance: 0.9,
        explication: 'Incohérent : année saisie invalide (format attendu : 4 chiffres, 1900-2100).',
      };
    }
    if (!texte || texte.trim().length < 10) {
      return {
        champ: 'bacAnnee',
        label: LABEL_ANNEE_BAC,
        valeurSaisie: cleanedYear,
        valeurExtraite: null,
        statut: VerificationFieldStatus.NON_DETECTE,
        score: 0,
        confiance: 0,
        explication: EXPLICATION_DOC_ILLISIBLE,
      };
    }
    // Chercher toutes les années 4 chiffres dans le texte
    const yearMatches: string[] = texte.match(/\b(19\d{2}|20\d{2})\b/g) ?? [];
    const yearCandidates = yearMatches.map((s) => s.trim());
    if (yearCandidates.length === 0) {
      return {
        champ: 'bacAnnee',
        label: LABEL_ANNEE_BAC,
        valeurSaisie: cleanedYear,
        valeurExtraite: null,
        statut: VerificationFieldStatus.NON_DETECTE,
        score: 0,
        confiance: 0.3,
        explication: `Non trouvé : aucune année 4 chiffres détectée. Saisie ${cleanedYear} non retrouvée.`,
      };
    }
    const found = yearCandidates.includes(cleanedYear);
    if (found) {
      return {
        champ: 'bacAnnee',
        label: LABEL_ANNEE_BAC,
        valeurSaisie: cleanedYear,
        valeurExtraite: cleanedYear,
        statut: VerificationFieldStatus.CONFORME,
        score: 100,
        confiance: 0.98,
        explication: `Vérifié : année ${cleanedYear} retrouvée dans le document.`,
        details: { candidates: yearCandidates.slice(0, 10) },
      };
    }
    // Prendre la plus proche année (diff 1 an -> à vérifier)
    let bestDiff = Infinity;
    let bestYear: string | null = null;
    for (const cand of yearCandidates) {
      const diff = Math.abs(Number.parseInt(cand, 10) - Number.parseInt(cleanedYear, 10));
      if (diff < bestDiff) {
        bestDiff = diff;
        bestYear = cand;
      }
    }
    if (bestDiff === 1) {
      return {
        champ: 'bacAnnee',
        label: LABEL_ANNEE_BAC,
        valeurSaisie: cleanedYear,
        valeurExtraite: bestYear,
        statut: VerificationFieldStatus.A_VERIFIER,
        score: 60,
        confiance: 0.6,
        explication: `À vérifier : année proche détectée ${bestYear} vs saisie ${cleanedYear} (écart 1 an).`,
        details: { candidates: yearCandidates.slice(0, 10) },
      };
    }
    return {
      champ: 'bacAnnee',
      label: LABEL_ANNEE_BAC,
      valeurSaisie: cleanedYear,
      valeurExtraite: bestYear || yearCandidates[0],
      statut: VerificationFieldStatus.NON_CONFORME,
      score: 0,
      confiance: 0.85,
      explication: `Incohérent : année détectée ${bestYear || yearCandidates[0]} ≠ saisie ${cleanedYear}.`,
      details: { candidates: yearCandidates.slice(0, 10) },
    };
  }

  private verifyCentre(centreSaisi: string | null, texte: string): VerificationFieldResult {
    const valeurSaisie = centreSaisi?.trim() || null;
    if (!valeurSaisie) {
      return {
        champ: 'centreExamen',
        label: LABEL_CENTRE_EXAMEN,
        valeurSaisie: null,
        valeurExtraite: null,
        statut: VerificationFieldStatus.NON_DETECTE,
        score: 0,
        confiance: 0,
        explication: 'Aucun centre d’examen saisi.',
      };
    }
    if (!texte || texte.trim().length < 10) {
      return {
        champ: 'centreExamen',
        label: LABEL_CENTRE_EXAMEN,
        valeurSaisie: normalizeCentre(valeurSaisie),
        valeurExtraite: null,
        statut: VerificationFieldStatus.NON_DETECTE,
        score: 0,
        confiance: 0,
        explication: EXPLICATION_DOC_ILLISIBLE,
      };
    }
    const cmp = compareCentres(valeurSaisie, texte);
    const normSaisie = normalizeCentre(valeurSaisie);
    const normExtrait = cmp.detectedSnippet ? normalizeCentre(cmp.detectedSnippet) : null;

    if (cmp.similarity >= 0.95) {
      return {
        champ: 'centreExamen',
        label: LABEL_CENTRE_EXAMEN,
        valeurSaisie: normSaisie,
        valeurExtraite: normExtrait,
        statut: VerificationFieldStatus.CONFORME,
        score: 100,
        confiance: cmp.confidence,
        explication: 'Vérifié : centre d’examen retrouvé.',
        details: { similarity: cmp.similarity },
      };
    }
    if (cmp.similarity >= 0.7) {
      return {
        champ: 'centreExamen',
        label: LABEL_CENTRE_EXAMEN,
        valeurSaisie: normSaisie,
        valeurExtraite: normExtrait,
        statut: VerificationFieldStatus.A_VERIFIER,
        score: Math.round(cmp.similarity * 100),
        confiance: cmp.confidence,
        explication:
          'À vérifier : centre probablement correspondant mais variante d’écriture ou OCR incertain.',
        details: { similarity: cmp.similarity },
      };
    }
    if (cmp.similarity >= 0.4) {
      return {
        champ: 'centreExamen',
        label: LABEL_CENTRE_EXAMEN,
        valeurSaisie: normSaisie,
        valeurExtraite: normExtrait,
        statut: VerificationFieldStatus.NON_CONFORME,
        score: Math.round(cmp.similarity * 50),
        confiance: 0.6,
        explication: 'Incohérent : centre différent de celui détecté.',
        details: { similarity: cmp.similarity },
      };
    }
    return {
      champ: 'centreExamen',
      label: LABEL_CENTRE_EXAMEN,
      valeurSaisie: normSaisie,
      valeurExtraite: normExtrait,
      statut: VerificationFieldStatus.NON_DETECTE,
      score: 0,
      confiance: 0.2,
      explication: 'Non trouvé : aucun centre exploitable.',
      details: { similarity: cmp.similarity },
    };
  }

  private verifyBordereauStrict(
    bordereauSaisi: string | null,
    texte: string,
    existingBordereaux: string[],
  ): VerificationFieldResult {
    const valeurSaisie = bordereauSaisi?.trim() || null;
    if (!valeurSaisie) {
      return {
        champ: 'bordereau',
        label: 'Numéro de bordereau',
        valeurSaisie: null,
        valeurExtraite: null,
        statut: VerificationFieldStatus.NON_DETECTE,
        score: 0,
        confiance: 0,
        explication: 'Aucun numéro de bordereau saisi.',
      };
    }
    const normSaisie = normalizeBordereau(valeurSaisie);
    if (!texte || texte.trim().length < 5) {
      // Extraire aussi pour debug
      return {
        champ: 'bordereau',
        label: 'Numéro de bordereau',
        valeurSaisie: normSaisie,
        valeurExtraite: null,
        statut: VerificationFieldStatus.NON_DETECTE,
        score: 0,
        confiance: 0,
        explication:
          'Lecture impossible : document du bordereau absent ou illisible (aucun texte extrait).',
        details: { lecture: 'impossible', normalizedExpected: normSaisie },
      };
    }

    const res = verifyBordereauStrict(valeurSaisie, texte, existingBordereaux);
    const mapScore: Record<string, number> = {
      conforme: 100,
      a_verifier: 60,
      non_conforme: 0,
      non_detecte: 0,
    };
    const mapStatus: Record<string, VerificationFieldStatus> = {
      conforme: VerificationFieldStatus.CONFORME,
      a_verifier: VerificationFieldStatus.A_VERIFIER,
      non_conforme: VerificationFieldStatus.NON_CONFORME,
      non_detecte: VerificationFieldStatus.NON_DETECTE,
    };
    // Extraction complète pour détails
    const full = extractBordereauFull(texte);
    return {
      champ: 'bordereau',
      label: 'Numéro de bordereau',
      valeurSaisie: res.normalizedExpected || normSaisie,
      valeurExtraite: res.normalizedDetected || res.detected || null,
      statut: mapStatus[res.status] || VerificationFieldStatus.NON_DETECTE,
      score: mapScore[res.status] ?? 0,
      confiance: res.confidence,
      explication: res.explication,
      details: {
        isDuplicate: res.isDuplicate,
        duplicateFound: res.duplicateFound,
        referenceField: full.referenceField,
        detectedModel: full.detectedModel,
        allNumbers: full.allNumbers.slice(0, 10),
        allAlphanumerics: full.allAlphanumerics.slice(0, 10),
        dates: full.dates.slice(0, 5),
        montants: full.montants.slice(0, 5),
        candidates: full.details.candidates.slice(0, 5),
      },
    };
  }

  private verifyReleveNotes(texte: string): VerificationFieldResult {
    if (!texte || texte.trim().length < 20) {
      return {
        champ: 'releveNotes',
        label: LABEL_RELEVE_NOTES,
        valeurSaisie: 'Relevé attendu',
        valeurExtraite: null,
        statut: VerificationFieldStatus.NON_DETECTE,
        score: 0,
        confiance: 0,
        explication:
          'Lecture impossible : aucun relevé de notes lisible (texte vide, scan illisible ou document manquant).',
        details: { lecture: 'impossible', matieres: [], estimatedPages: 0 },
      };
    }
    const releve = extractReleveNotes(texte);
    if (releve.matieres.length === 0) {
      return {
        champ: 'releveNotes',
        label: LABEL_RELEVE_NOTES,
        valeurSaisie: 'Relevé attendu',
        valeurExtraite: null,
        statut: VerificationFieldStatus.NON_DETECTE,
        score: 0,
        confiance: releve.confidence,
        explication: `Non trouvé : aucune matière détectée. ${releve.warnings.join(' ')}`,
        details: {
          matieres: [],
          warnings: releve.warnings,
          estimatedPages: releve.estimatedPages,
          confidence: releve.confidence,
        },
      };
    }
    // Cas succès : au moins 3 matières
    if (releve.matieres.length >= 3) {
      const hasWarnings = releve.warnings.length > 0;
      if (hasWarnings) {
        return {
          champ: 'releveNotes',
          label: LABEL_RELEVE_NOTES,
          valeurSaisie: `${releve.matieres.length} matières attendues`,
          valeurExtraite: `${releve.matieres.length} matières détectées${formatMoyenneSuffix(releve.moyenneCalculee)}`,
          statut: VerificationFieldStatus.A_VERIFIER,
          score: Math.round(releve.confidence * 100),
          confiance: releve.confidence,
          explication: `À vérifier : ${releve.matieres.length} matières détectées mais ${releve.warnings.join(' ')}`,
          details: {
            matieres: releve.matieres,
            moyenneCalculee: releve.moyenneCalculee,
            moyenneExtraite: releve.moyenneExtraite,
            mention: releve.mention,
            warnings: releve.warnings,
            estimatedPages: releve.estimatedPages,
          },
        };
      }
      return {
        champ: 'releveNotes',
        label: LABEL_RELEVE_NOTES,
        valeurSaisie: `${releve.matieres.length} matières`,
        valeurExtraite: `${releve.matieres.length} matières, moyenne ${releve.moyenneCalculee ?? releve.moyenneExtraite ?? '—'}`,
        statut: VerificationFieldStatus.CONFORME,
        score: 100,
        confiance: releve.confidence,
        explication: `Vérifié : ${releve.matieres.length} matières extraites, fusion multi-pages OK, moyenne ${releve.moyenneCalculee ?? releve.moyenneExtraite ?? 'non calculable'}.`,
        details: {
          matieres: releve.matieres,
          moyenneCalculee: releve.moyenneCalculee,
          moyenneExtraite: releve.moyenneExtraite,
          moyenneExtraiteNum: releve.moyenneExtraiteNum,
          mention: releve.mention,
          session: releve.session,
          estimatedPages: releve.estimatedPages,
        },
      };
    }
    // 1-2 matières -> à vérifier / non détecté
    const matieresExtraites = releve.matieres
      .map((m) => `${m.matiere} ${m.noteRaw}/${m.coefficientRaw || '—'}`)
      .join(', ');
    return {
      champ: 'releveNotes',
      label: LABEL_RELEVE_NOTES,
      valeurSaisie: 'Relevé complet attendu',
      valeurExtraite: `${releve.matieres.length} matière(s) : ${matieresExtraites}`,
      statut: VerificationFieldStatus.A_VERIFIER,
      score: Math.round(releve.confidence * 100),
      confiance: releve.confidence,
      explication: `À vérifier : seulement ${releve.matieres.length} matière(s) détectée(s) — document incomplet ou qualité OCR limitée.`,
      details: {
        matieres: releve.matieres,
        warnings: releve.warnings,
        estimatedPages: releve.estimatedPages,
      },
    };
  }

  private computeGlobal(
    results: VerificationFieldResult[],
    docs: VerificationDocumentInfo[],
  ): { score: number; statut: VerificationGlobalStatus } {
    const weights: Record<string, number> = {
      nom: 15,
      prenom: 15,
      dateNaissance: 10,
      lieuNaissance: 8,
      numeroBac: 15,
      bacAnnee: 7,
      centreExamen: 10,
      bordereau: 15,
      releveNotes: 5,
    };
    const stats = this.getGlobalResultStats(results, weights);
    const score = stats.totalWeight > 0 ? Math.round(stats.weightedScore / stats.totalWeight) : 0;

    const anyTextExtracted = docs.some((d) => d.texteExtraitLongueur > 10);
    const allNonDetecte = results.every((r) => r.statut === VerificationFieldStatus.NON_DETECTE);
    if (!anyTextExtracted && docs.length === 0) {
      return { score, statut: VerificationGlobalStatus.IMPOSSIBLE };
    }
    if (allNonDetecte && !anyTextExtracted) {
      return { score, statut: VerificationGlobalStatus.IMPOSSIBLE };
    }

    // Si bordereau duplicate => incompatible direct
    const bordereau = results.find((r) => r.champ === 'bordereau');
    if (bordereau?.details && Boolean(bordereau.details['isDuplicate'])) {
      return { score, statut: VerificationGlobalStatus.INCOMPATIBLE };
    }

    if (stats.hasNonConforme) {
      return { score, statut: VerificationGlobalStatus.INCOMPATIBLE };
    }
    if (stats.hasAVerifier || (stats.hasNonDetecte && stats.detectableCount > 0)) {
      return { score, statut: VerificationGlobalStatus.VERIFICATION_MANUELLE };
    }
    if (score >= 80) {
      return { score, statut: VerificationGlobalStatus.CONFORME };
    }
    if (score >= 50) {
      return { score, statut: VerificationGlobalStatus.VERIFICATION_MANUELLE };
    }
    return { score, statut: VerificationGlobalStatus.INCOMPATIBLE };
  }

  private getGlobalResultStats(
    results: VerificationFieldResult[],
    weights: Record<string, number>,
  ): {
    totalWeight: number;
    weightedScore: number;
    hasNonConforme: boolean;
    hasAVerifier: boolean;
    hasNonDetecte: boolean;
    detectableCount: number;
  } {
    return results.reduce(
      (stats, result) => {
        const weight = weights[result.champ] ?? 5;
        stats.totalWeight += weight;
        stats.weightedScore += result.score * weight;
        stats.hasNonConforme ||= result.statut === VerificationFieldStatus.NON_CONFORME;
        stats.hasAVerifier ||= result.statut === VerificationFieldStatus.A_VERIFIER;
        stats.hasNonDetecte ||= result.statut === VerificationFieldStatus.NON_DETECTE;
        stats.detectableCount += result.statut !== VerificationFieldStatus.NON_DETECTE ? 1 : 0;
        return stats;
      },
      {
        totalWeight: 0,
        weightedScore: 0,
        hasNonConforme: false as boolean,
        hasAVerifier: false as boolean,
        hasNonDetecte: false as boolean,
        detectableCount: 0,
      },
    );
  }

  async getHistory(admissionId: number): Promise<AdmissionVerification[]> {
    await this.ensureVerificationsTable();
    await this.ensureAdmissionExists(admissionId);
    try {
      return await this.verificationsRepository.find({
        where: { admissionId },
        order: { creeLe: 'DESC' },
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (
        msg.includes('admission_verifications') &&
        (msg.includes("n'existe pas") || msg.includes('does not exist'))
      ) {
        return [];
      }
      throw e;
    }
  }

  async getLatest(admissionId: number): Promise<AdmissionVerification | null> {
    await this.ensureVerificationsTable();
    await this.ensureAdmissionExists(admissionId);
    try {
      return await this.verificationsRepository.findOne({
        where: { admissionId },
        order: { creeLe: 'DESC' },
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (
        msg.includes('admission_verifications') &&
        (msg.includes("n'existe pas") || msg.includes('does not exist'))
      ) {
        return null;
      }
      throw e;
    }
  }

  async getOne(admissionId: number, verificationId: number): Promise<AdmissionVerification> {
    await this.ensureVerificationsTable();
    await this.ensureAdmissionExists(admissionId);
    const v = await this.verificationsRepository.findOne({
      where: { id: verificationId, admissionId },
    });
    if (!v) throw new NotFoundException('Vérification introuvable');
    return v;
  }

  private async ensureAdmissionExists(id: number): Promise<Admission> {
    const adm = await this.admissionsRepository.findOne({ where: { id } });
    if (!adm) throw new NotFoundException(`Admission ${id} non trouvée`);
    return adm;
  }
}
