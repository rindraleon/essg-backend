import { normalizeText } from './normalization.util';

export interface Matiere {
  matiere: string;
  note: number | null;
  noteRaw: string | null;
  coefficient: number | null;
  coefficientRaw: string | null;
  observation: string | null;
  // Pour affichage
  originalLine: string;
}

export interface ReleveExtractionResult {
  matieres: Matiere[];
  moyenneCalculee: number | null;
  moyenneExtraite: string | null;
  moyenneExtraiteNum: number | null;
  mention: string | null;
  session: string | null;
  totalMatieres: number;
  cleanedText: string;
  confidence: number;
  estimatedPages: number;
  warnings: string[];
}

const MATIERE_LABELS = [
  'malagasy',
  'français',
  'francais',
  'anglais',
  'philosophie',
  'histoire',
  'géographie',
  'geographie',
  'mathématiques',
  'mathematiques',
  'maths',
  'physique',
  'chimie',
  'svt',
  'science',
  'eps',
  'éducation',
  'education',
  'informatique',
  'economie',
  'économie',
  'comptabilité',
  'comptabilite',
  'gestion',
  'droit',
  // Ajouts L3
  'algorithmique',
  'base de données',
  'base de donnees',
  'réseaux',
  'reseaux',
  'système',
  'systeme',
  'programmation',
  'projet',
  'stage',
];

function buildMatiereRegex(): RegExp {
  const alt = MATIERE_LABELS.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

  return new RegExp(
    String.raw`\b(${alt})[^\d]{0,10}(\d{1,2}(?:[.,]\d{1,2})?)(?:[ \t]{0,10}/[ \t]{0,10}\d{1,2})?(?:[ \t]{0,10}coeff(?:icient)?[ \t]{0,10}:?[ \t]{0,10}(\d{1,2})|[ \t]{1,10}(\d{1,2}))?[ \t]{0,10}([A-Za-zéèêàù ]{0,20})?`,
    'gi',
  );
}

/** Nombre décimal au format FR (ex. 12 ; 12,5 ; 08.25), borné pour éviter tout backtracking. */
const DECIMAL_NOTE_PATTERN = String.raw`\d{1,3}(?:[,.]\d{1,2})?`;

/** Ligne de tableau : Matière ⇥ Coeff ⇥ Note ⇥ Max (colonnes séparées par ≥2 espaces). */
const TABLE_LINE_PATTERN = new RegExp(
  String.raw`^(\S(?:[^\n]{0,198}\S)?)\s{2,40}(\S+)\s{1,20}(${DECIMAL_NOTE_PATTERN})\s{1,20}(${DECIMAL_NOTE_PATTERN})\s{0,10}$`,
);

/** Ligne « souple » : Matière Coeff Note Max séparés par des espaces simples. */
const LOOSE_LINE_PATTERN = new RegExp(
  String.raw`^(\S(?:[^\n]{0,198}\S)?)\s{1,20}(\S+)\s{1,20}(${DECIMAL_NOTE_PATTERN})\s{1,20}(\d{1,3})\s{0,10}$`,
);

/** Ligne générique « Matière Note [/20] Coeff [observation] ». */
const GENERIC_LINE_PATTERN =
  /^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' -]{2,40})\s+(\d{1,2}(?:[,.]\d{1,2})?)\s{0,10}(?:\/\s{0,5}20)?\s+(\d{1,2})\s{0,10}(.{0,200})$/;

/** Parenthèses et leurs espaces environnants (ex. « Anglais (Facultative) »). */
const PARENTHESIS_PATTERN = /\s{0,10}\([^()]{0,120}\)\s{0,10}/;

/** Date seule (jj/mm/aaaa) pour exclure les lignes qui n'en sont pas. */
const DATE_ONLY_PATTERN = /^\d{1,2}[-/.]\d{1,2}[-/.]\d{4}$/;

/** Au moins une note décimale ou un petit entier isolé. */
const HAS_NOTE_PATTERN = /\d{1,2}[,.]\d{1,2}|\b\d{1,2}\b/;

const MOYENNE_PATTERNS = [
  /moyenne\s{0,10}(?:générale|generale)?\s{0,10}[:-]?\s{0,10}(\d{1,2}[,.]\d{1,2})/i,
  /moy\.\s{0,10}[:-]?\s{0,10}(\d{1,2}[,.]\d{1,2})/i,
  /total[^:\n]{0,80}:\s{0,10}\d{1,10}.{0,120}moyenne\s{0,10}(\d{1,2}[,.]\d{1,2})/i,
];

const MENTION_PATTERN =
  /\b(passable|assez\s{0,3}bien|bien|très\s{0,3}bien|tres\s{0,3}bien|excellent|ajourné|ajourne|admis|admissible)\b/i;

const SESSION_PATTERN = /\b(session|année|annee)\s{0,10}[:-]?\s{0,10}(\d{4})\b/i;

const NON_MATIERE_KEYWORDS =
  /moyenne|total|coefficient|matière|matiere|session|centre|numéro|numero/i;

function emptyResult(): ReleveExtractionResult {
  return {
    matieres: [],
    moyenneCalculee: null,
    moyenneExtraite: null,
    moyenneExtraiteNum: null,
    mention: null,
    session: null,
    totalMatieres: 0,
    cleanedText: '',
    confidence: 0,
    estimatedPages: 0,
    warnings: ['Document vide ou illisible (aucun texte extrait).'],
  };
}

function isKnownMatiere(rawMatiere: string): boolean {
  return MATIERE_LABELS.some((lbl) =>
    normalizeText(rawMatiere).includes(normalizeText(lbl).split(' ')[0]),
  );
}

function pushMatiere(matieres: Matiere[], entry: Matiere): void {
  matieres.push(entry);
}

/**
 * Approche 1a : format tableau « Matières | Coeff | Notes déf | NotesMax ».
 */
function parseTableSection(cleanedText: string, matieres: Matiere[]): void {
  const hasTableHeader =
    /Matières\s{0,20}\|\s{0,20}Coeff/i.test(cleanedText) ||
    /RELEVE\s+DES\s+NOTES/i.test(cleanedText);
  if (!hasTableHeader) return;

  let inTable = false;
  for (const rawLine of cleanedText.split(/\n/)) {
    const line = rawLine.trim();
    if (!inTable) {
      inTable = /Matières/i.test(line) && /Coeff/i.test(line);
      continue;
    }
    if (/TOTAL|MOYENNE|Décision du Jury|Fait à/i.test(line)) break;
    if (!line || line.length < 3) continue;

    const tableMatch = TABLE_LINE_PATTERN.exec(line);
    if (tableMatch) {
      parseTableLine(line, tableMatch, matieres);
      continue;
    }
    // Fallback : colonnes séparées par espace simple (gère « Anglais (Facultative) »)
    const looseMatch = LOOSE_LINE_PATTERN.exec(line);
    if (looseMatch) {
      parseLooseLine(line, looseMatch, matieres);
    }
  }
}

function parseTableLine(line: string, tableMatch: RegExpExecArray, matieres: Matiere[]): void {
  const rawMatiere = tableMatch[1].trim().replace(/\s{2,40}/g, ' ');
  // Filtrer si matière ne contient pas au moins une matière connue ou si c'est un total
  if (!isKnownMatiere(rawMatiere) && rawMatiere.length <= 5) return;

  const rawCoeff = tableMatch[2].trim();
  const rawNote = tableMatch[3].trim();
  const rawMax = tableMatch[4].trim();
  const coeffVal =
    rawCoeff.toUpperCase() === 'BONI' ? null : parseFloat(rawCoeff.replace(',', '.'));
  const noteVal = parseNote(rawNote);
  if (noteVal === null || noteVal < 0 || noteVal > 100) return;
  const coeffNum = Number.isFinite(coeffVal) ? (coeffVal as number) : null;
  // Éviter doublon matière
  if (matieres.some((m) => normalizeText(m.matiere) === normalizeText(rawMatiere))) return;
  pushMatiere(matieres, {
    matiere: capitalizeMatiere(rawMatiere),
    note: noteVal,
    noteRaw: `${rawNote}/${rawMax}`,
    coefficient: coeffNum,
    coefficientRaw: rawCoeff,
    observation: null,
    originalLine: line.slice(0, 120),
  });
}

function parseLooseLine(line: string, looseMatch: RegExpExecArray, matieres: Matiere[]): void {
  const rawMatiere = looseMatch[1].trim();
  const rawCoeff = looseMatch[2].trim();
  const rawNote = looseMatch[3].trim();
  const rawMax = looseMatch[4].trim();
  if (/TOTAL|MOYENNE/i.test(rawMatiere) || rawMatiere.length < 3) return;
  // Vérifier que c'est bien une matière (évite de parser TOTAL etc.)
  if (!isKnownMatiere(rawMatiere) && !/Anglais|Facultative/i.test(rawMatiere)) return;

  const coeffVal =
    rawCoeff.toUpperCase() === 'BONI' ? null : Number.parseFloat(rawCoeff.replace(',', '.'));
  const noteVal = parseNote(rawNote);
  const maxVal = Number.parseFloat(rawMax.replace(',', '.'));
  if (noteVal === null || noteVal > 100 || !Number.isFinite(maxVal) || maxVal <= 0) return;
  pushMatiere(matieres, {
    matiere: capitalizeMatiere(rawMatiere.replace(PARENTHESIS_PATTERN, '').trim() || rawMatiere),
    note: noteVal,
    noteRaw: `${rawNote}/${rawMax}`,
    coefficient: Number.isFinite(coeffVal) ? (coeffVal as number) : null,
    coefficientRaw: rawCoeff,
    observation: null,
    originalLine: line.slice(0, 120),
  });
}

/**
 * Approche 1b : motif « <matière connue> <note> [coeff] » via le dictionnaire de matières.
 */
function parseKnownMatiereLines(
  cleanedText: string,
  seenKeys: Set<string>,
  matieres: Matiere[],
): void {
  const matiereRegex = buildMatiereRegex();
  let match = matiereRegex.exec(cleanedText);
  while (match !== null) {
    const rawMatiere = match[1].trim();
    const rawNote = match[2].trim();
    const rawCoeff = (match[3] || match[4] || null)?.trim() || null;
    const rawObs = match[5]?.trim() || null;

    const key = `${rawMatiere}|${rawNote}|${rawCoeff}`.toLowerCase();
    if (!seenKeys.has(key)) {
      seenKeys.add(key);

      const note = parseNote(rawNote);
      const coeff = rawCoeff ? Number.parseFloat(rawCoeff.replace(',', '.')) : null;

      // Filtrer les faux positifs : note 0-100 (relevé BAC gère 50/100, 54/60 etc.), on garde 0-100
      if (note === null || (note >= 0 && note <= 100)) {
        matieres.push({
          matiere: capitalizeMatiere(rawMatiere),
          note,
          noteRaw: rawNote,
          coefficient: Number.isFinite(coeff) ? coeff : null,
          coefficientRaw: rawCoeff,
          observation: rawObs ? rawObs.trim() : null,
          originalLine: match[0].trim().slice(0, 120),
        });
      }
    }
    match = matiereRegex.exec(cleanedText);
  }
}

/**
 * Approche 2 : détection tabulaire générique (lignes contenant chiffres).
 * Pattern générique « <texte> <note> <coeff> », ex. « Informatique 15,5 3 ».
 */
function parseGenericLines(cleanedText: string, seenKeys: Set<string>, matieres: Matiere[]): void {
  for (const line of cleanedText.split(/\n/)) {
    const trimmed = line.trim();
    if (trimmed.length < 5 || trimmed.length > 120) continue;
    // Doit contenir au moins un nombre avec décimal potentiel
    if (!HAS_NOTE_PATTERN.test(trimmed)) continue;
    // Éviter lignes qui sont des dates ou montants
    if (DATE_ONLY_PATTERN.test(trimmed)) continue;

    const genericMatch = GENERIC_LINE_PATTERN.exec(trimmed);
    if (!genericMatch) continue;

    const rawMatiere = genericMatch[1].trim();
    // Éviter mots-clés non-matière
    if (NON_MATIERE_KEYWORDS.test(rawMatiere)) continue;

    const rawNote = genericMatch[2];
    const rawCoeff = genericMatch[3];
    const key = `${rawMatiere}|${rawNote}|${rawCoeff}`.toLowerCase();
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    const note = parseNote(rawNote);
    const coeff = Number.parseFloat(rawCoeff.replace(',', '.'));
    if (note !== null && note >= 0 && note <= 20 && coeff >= 1 && coeff <= 10) {
      matieres.push({
        matiere: capitalizeMatiere(rawMatiere),
        note,
        noteRaw: rawNote,
        coefficient: coeff,
        coefficientRaw: rawCoeff,
        observation: genericMatch[4]?.trim() || null,
        originalLine: trimmed.slice(0, 120),
      });
    }
  }
}

function average(notes: number[]): number {
  return Math.round((notes.reduce((a, b) => a + b, 0) / notes.length) * 100) / 100;
}

/**
 * Calcul de la moyenne selon deux régimes :
 * - tableau BAC (noteRaw « note/max ») : moyenne = somme(notes) / somme(coeffs) ;
 * - format générique : moyenne pondérée somme(note*coeff) / somme(coeffs).
 */
function computeMoyenne(finalMatieres: Matiere[]): number | null {
  const hasTableWithMax = finalMatieres.some((m) => m.noteRaw && m.noteRaw.includes('/'));
  const withCoeffs = finalMatieres.filter(
    (m) => m.note !== null && m.coefficient !== null && m.coefficient > 0,
  );
  const notes = finalMatieres.map((m) => m.note).filter((n): n is number => n !== null);

  if (hasTableWithMax) {
    const totalNotesAll = notes.reduce((s, n) => s + n, 0);
    const totalCoeff = withCoeffs.reduce((sum, m) => sum + (m.coefficient as number), 0);
    if (totalCoeff > 0) return Math.round((totalNotesAll / totalCoeff) * 100) / 100;
    if (notes.length >= 2) return average(notes);
    return null;
  }

  if (withCoeffs.length >= 2) {
    const totalCoeff = withCoeffs.reduce((sum, m) => sum + (m.coefficient as number), 0);
    const totalPoints = withCoeffs.reduce(
      (sum, m) => sum + (m.note as number) * (m.coefficient as number),
      0,
    );
    if (totalCoeff > 0) return Math.round((totalPoints / totalCoeff) * 100) / 100;
  }

  if (finalMatieres.length >= 2 && notes.length > 0) {
    // Moyenne simple si pas de coeffs
    return average(notes);
  }
  return null;
}

function computeConfidence(
  finalMatieres: Matiere[],
  withCoeffsCount: number,
  hasMoyenneExtraite: boolean,
): number {
  let confidence = 0;
  if (finalMatieres.length === 0) confidence = 0.1;
  else if (finalMatieres.length < 3) confidence = 0.4;
  else if (finalMatieres.length < 6) confidence = 0.7;
  else confidence = 0.85;
  if (withCoeffsCount >= 3) confidence = Math.min(0.95, confidence + 0.1);
  if (hasMoyenneExtraite) confidence = Math.min(0.95, confidence + 0.05);
  return confidence;
}

/**
 * Détecte et extrait toutes les lignes de notes depuis le texte
 */
export function extractReleveNotes(text: string): ReleveExtractionResult {
  if (!text || text.trim().length < 10) {
    return emptyResult();
  }

  const cleanedText = text.replace(/\r/g, '\n').replace(/\u00A0/g, ' ');

  // Estimation pages : compter occurrences de mots-clés en-tête
  const headerCount = (cleanedText.match(/relevé|releve|bulletin|notes/gi) || []).length;
  const estimatedPages = Math.max(
    1,
    Math.min(10, headerCount || Math.ceil(cleanedText.length / 3000)),
  );

  const warnings: string[] = [];
  const matieres: Matiere[] = [];
  const seenKeys = new Set<string>();

  parseTableSection(cleanedText, matieres);
  if (matieres.length < 5) {
    parseKnownMatiereLines(cleanedText, seenKeys, matieres);
  }
  // Si peu de matières trouvées, chercher le pattern générique « <texte> <note> <coeff> »
  if (matieres.length < 3) {
    parseGenericLines(cleanedText, seenKeys, matieres);
  }

  // Déduplication finale par nom de matière (garder première occurrence)
  const deduped = new Map<string, Matiere>();
  for (const m of matieres) {
    const key = normalizeText(m.matiere).toLowerCase();
    if (!deduped.has(key)) deduped.set(key, m);
  }
  const finalMatieres = [...deduped.values()];

  // Extraction moyenne / mention / session
  const moyenneExtraite = extractMoyenne(cleanedText);
  const moyenneExtraiteNum = moyenneExtraite ? parseNote(moyenneExtraite) : null;
  const mention = extractMention(cleanedText);
  const session = extractSession(cleanedText);
  const moyenneCalculee = computeMoyenne(finalMatieres);

  collectWarnings(warnings, finalMatieres, moyenneExtraiteNum, moyenneCalculee);

  const withCoeffsCount = finalMatieres.filter(
    (m) => m.note !== null && m.coefficient !== null && m.coefficient > 0,
  ).length;
  const confidence = computeConfidence(finalMatieres, withCoeffsCount, Boolean(moyenneExtraite));

  return {
    matieres: finalMatieres,
    moyenneCalculee,
    moyenneExtraite,
    moyenneExtraiteNum,
    mention,
    session,
    totalMatieres: finalMatieres.length,
    cleanedText,
    confidence,
    estimatedPages,
    warnings,
  };
}

function collectWarnings(
  warnings: string[],
  finalMatieres: Matiere[],
  moyenneExtraiteNum: number | null,
  moyenneCalculee: number | null,
): void {
  if (finalMatieres.length === 0) {
    warnings.push(
      'Aucune matière détectée — relevé illisible, scan de mauvaise qualité ou document non reconnu.',
    );
  } else if (finalMatieres.length < 3) {
    warnings.push(
      `Peu de matières détectées (${finalMatieres.length}) — document peut être incomplet ou multi-pages mal fusionnées.`,
    );
  }
  if (
    moyenneExtraiteNum !== null &&
    moyenneCalculee !== null &&
    Math.abs(moyenneExtraiteNum - moyenneCalculee) > 0.5
  ) {
    warnings.push(
      `Écart entre moyenne extraite (${moyenneExtraiteNum}) et moyenne calculée (${moyenneCalculee}) — vérifier les coefficients.`,
    );
  }
}

function parseNote(raw: string): number | null {
  if (!raw) return null;
  let cleaned = raw
    .trim()
    .replace(',', '.')
    .replace(/\s{1,20}/g, '');
  // Gérer "08/20" -> 08
  if (cleaned.includes('/')) cleaned = cleaned.split('/')[0];
  const num = Number.parseFloat(cleaned);
  if (Number.isNaN(num)) return null;
  return Math.round(num * 100) / 100;
}

function extractMoyenne(text: string): string | null {
  for (const pat of MOYENNE_PATTERNS) {
    const m = pat.exec(text);
    if (m) return m[1];
  }
  return null;
}

function extractMention(text: string): string | null {
  const m = MENTION_PATTERN.exec(text);
  return m ? m[0] : null;
}

function extractSession(text: string): string | null {
  const m = SESSION_PATTERN.exec(text);
  return m ? m[0] : null;
}

function capitalizeMatiere(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .split(/[\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
