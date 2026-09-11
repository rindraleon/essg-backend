import { normalizeBordereau } from './normalization.util';
import { similarityRatio } from './similarity.util';

export interface BordereauExtractionResult {
  /** Tous les nombres trouvés (séquences de chiffres) */
  allNumbers: string[];
  /** Tous les tokens alphanumériques (6+ caractères) */
  allAlphanumerics: string[];
  /** Numéro de bordereau détecté (le plus probable) */
  bordereauNumber: string | null;
  /** Variante normalisée du bordereau */
  bordereauNormalized: string | null;
  /** Toutes les références alphanumériques contenant chiffres (candidats bordereau) */
  transactionReferences: string[];
  /** Dates trouvées */
  dates: string[];
  /** Montants trouvés (avec devise) */
  montants: string[];
  /** Texte brut nettoyé */
  cleanedText: string;
  /** Confiance globale */
  confidence: number;
  /** Détails pour debug */
  details: {
    candidates: string[];
    bestScore: number;
    allMatches: string[];
  };
}

const BORDEREAU_PATTERNS: RegExp[] = [
  // Forme avec préfixe explicite
  /\b(?:bordereau|bord|bdr|brd|ref|reference|transaction|recu|reçu|numero|numéro|n°|n\.?)[\s:_-]{0,20}([A-Z0-9][A-Z0-9\-_/.]{4,20})\b/gi,
  // Forme spécifique bordereau FABY / 200A... : 200A00028461, 20OA00026402, 34241001570-60 etc. (prioritaire)
  /\b\d{2,4}[A-Z0-9]\d{5,10}(?:[-_/]\d{1,4})?\b/g,
  // Forme avec séparateurs : AA-1234-5678, AA/1234, etc.
  /\b[A-Z]{2,4}[-_/\s]{0,10}\d{3,6}[-_/\s]{0,10}\d{3,6}\b/g,
  // Forme numérique pure longue (6-12 chiffres) souvent bordereau
  /\b\d{6,12}\b/g,
  // Forme alphanumérique avec tirets : 2026-001254, etc.
  /\b\d{4}[-_/]\d{3,6}\b/g,
];

const DATE_PATTERNS: RegExp[] = [
  /\b\d{1,2}[-/.]\d{1,2}[-/.]\d{4}\b/g,
  /\b\d{1,2}\s+(?:janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+\d{4}\b/gi,
];

const MONTANT_PATTERNS: RegExp[] = [
  // 150 000 Ar, 150000 MGA, 50.000, 1 200,00 etc.
  /\b\d{1,3}(?:[\s.']\d{3}){0,10}(?:[,.]\d{2})?\s{0,10}(?:Ar|MGA|Fmg|FMG|€|EUR)?\b/gi,
  /\b(?:montant|somme|total|payé|paye|versement)[\s:]{0,10}(\d[\d,.]{0,30})\s{0,10}(?:Ar|MGA)?\b/gi,
];

export function extractBordereauFull(text: string): BordereauExtractionResult {
  if (!text) {
    return emptyExtraction();
  }

  const cleanedText = text.replace(/\s+/g, ' ').trim();
  const numberMatches: string[] = text.match(/\d{3,20}/g) ?? [];
  const allNumbers = numberMatches.map((s) => s.trim()).filter(Boolean);
  const alphanumericMatches: string[] = text.match(/\b[A-Z\d][A-Z\d\-_/.]{5,20}\b/gi) ?? [];
  const allAlphanumerics = alphanumericMatches
    .filter((s) => /\d/.test(s))
    .map((s) => s.trim().toUpperCase())
    .filter((v, i, arr) => arr.indexOf(v) === i);

  const transactionReferences = allAlphanumerics.filter(
    (s) => /^[A-Z]{1,4}[-_/.]?\d/.test(s) || /\d[^A-Z]{0,30}[A-Z]/.test(s),
  );
  const dates = collectMatches(text, DATE_PATTERNS);
  const montants = collectMatches(text, MONTANT_PATTERNS, true);
  const matches = collectBordereauMatches(text);
  const selected = selectBordereau(matches.candidates, allAlphanumerics, text);
  const bordereauNumber = selected.number;
  const bestScore = selected.score;

  const bordereauNormalized = bordereauNumber ? normalizeBordereau(bordereauNumber) : null;

  const confidence = computeExtractionConfidence(bordereauNumber, bestScore, allNumbers.length);

  return {
    allNumbers,
    allAlphanumerics,
    bordereauNumber,
    bordereauNormalized,
    transactionReferences,
    dates: [...new Set(dates)],
    montants: [...new Set(montants)],
    cleanedText,
    confidence,
    details: {
      candidates: matches.candidates,
      bestScore,
      allMatches: [...new Set(matches.allMatches)],
    },
  };
}

function computeExtractionConfidence(
  bordereauNumber: string | null,
  bestScore: number,
  numberCount: number,
): number {
  if (bordereauNumber) {
    return Math.min(0.95, 0.5 + bestScore * 0.5);
  }
  return numberCount > 0 ? 0.3 : 0;
}

function emptyExtraction(): BordereauExtractionResult {
  return {
    allNumbers: [],
    allAlphanumerics: [],
    bordereauNumber: null,
    bordereauNormalized: null,
    transactionReferences: [],
    dates: [],
    montants: [],
    cleanedText: '',
    confidence: 0,
    details: { candidates: [], bestScore: 0, allMatches: [] },
  };
}

function collectMatches(text: string, patterns: RegExp[], capture = false): string[] {
  return patterns.flatMap((pat) => {
    pat.lastIndex = 0;
    return [...text.matchAll(pat)]
      .map((m) => (capture ? m[1] || m[0] : m[0]))
      .filter((v) => /\d/.test(v))
      .map((v) => v.trim());
  });
}

function collectBordereauMatches(text: string): { candidates: string[]; allMatches: string[] } {
  const candidates: string[] = [];
  const allMatches: string[] = [];
  for (const pat of BORDEREAU_PATTERNS) {
    pat.lastIndex = 0;
    for (const match of text.matchAll(pat)) {
      const candidate = (match[1] || match[0]).trim().toUpperCase();
      if (candidate.length >= 5) {
        candidates.push(candidate);
        allMatches.push(match[0]);
      }
    }
  }
  return { candidates: [...new Set(candidates.map((c) => c.replace(/\s+/g, '')))], allMatches };
}

function appearsAsWholeLine(normalized: string, lines: string[]): boolean {
  const compact = normalized.replace(/[-_/]/g, '');
  return lines.some((line) => {
    const clean = line.replace(/\s+/g, '').toUpperCase();
    return clean === normalized || clean === compact;
  });
}

function scoreBordereauCandidate(normalized: string, lines: string[]): number {
  let score = 0;
  if (/[A-Z]/.test(normalized) && /\d/.test(normalized)) score += 0.3;
  if (normalized.length >= 8 && normalized.length <= 20) score += 0.25;
  if (/^\d{3}[A-Z0-9]\d{7,8}$/.test(normalized.replace(/[-_/]/g, ''))) score += 0.35;
  if (/^(?:BDR|BRD|BOR)/.test(normalized)) score += 0.2;
  if (/\d{3,}/.test(normalized)) score += 0.1;
  if (appearsAsWholeLine(normalized, lines)) score += 0.4;
  if (['758020', '34241001570', '3424100157060'].includes(normalized)) score -= 0.5;
  const year = new Date().getFullYear();
  if (normalized.includes(String(year)) || normalized.includes(String(year - 1))) score += 0.05;
  return score;
}

function selectBordereau(
  candidates: string[],
  alphanumerics: string[],
  text: string,
): { number: string | null; score: number } {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  let number: string | null = null;
  let score = 0;
  for (const candidate of candidates) {
    const current = scoreBordereauCandidate(normalizeBordereau(candidate), lines);
    if (current > score) {
      score = current;
      number = candidate;
    }
  }
  if (!number && alphanumerics.length) {
    number = [...alphanumerics].sort((a, b) => b.length - a.length)[0];
    score = 0.4;
  }
  return { number, score };
}

export function verifyBordereauStrict(
  expected: string | null | undefined,
  extractedText: string,
  allExistingBordereaux?: string[],
): {
  status: 'conforme' | 'non_conforme' | 'non_detecte' | 'a_verifier';
  detected: string | null;
  normalizedExpected: string | null;
  normalizedDetected: string | null;
  confidence: number;
  explication: string;
  isDuplicate?: boolean;
  duplicateFound?: string | null;
} {
  const normalizedExpected = expected ? normalizeBordereau(expected) : null;

  if (!normalizedExpected) {
    return {
      status: 'non_detecte',
      detected: null,
      normalizedExpected: null,
      normalizedDetected: null,
      confidence: 0,
      explication: 'Aucun numéro de bordereau saisi.',
    };
  }

  if (!extractedText || extractedText.trim().length < 5) {
    return {
      status: 'non_detecte',
      detected: null,
      normalizedExpected,
      normalizedDetected: null,
      confidence: 0,
      explication: 'Document du bordereau absent ou illisible (aucun texte extrait).',
    };
  }

  const extraction = extractBordereauFull(extractedText);
  const detected = extraction.bordereauNumber;
  const normalizedDetected = extraction.bordereauNormalized;

  // Vérification unicité (si liste fournie) — la requête SQL exclut déjà la candidature courante
  let isDuplicate = false;
  let duplicateFound: string | null = null;
  if (allExistingBordereaux && normalizedExpected) {
    const normalizedExisting = allExistingBordereaux
      .filter(Boolean)
      .map((b) => normalizeBordereau(b));
    if (normalizedExisting.includes(normalizedExpected)) {
      isDuplicate = true;
      duplicateFound = normalizedExpected;
    }
  }

  if (isDuplicate) {
    return {
      status: 'non_conforme',
      detected,
      normalizedExpected,
      normalizedDetected,
      confidence: 0.95,
      explication: `Numéro de bordereau déjà utilisé par une autre candidature (unicité violée : ${normalizedExpected}).`,
      isDuplicate,
      duplicateFound,
    };
  }

  if (!detected || !normalizedDetected) {
    return {
      status: 'non_detecte',
      detected: null,
      normalizedExpected,
      normalizedDetected: null,
      confidence: 0.2,
      explication: `Aucune référence de bordereau détectée dans le document. Saisi : ${normalizedExpected}. Nombres trouvés : ${extraction.allNumbers.slice(0, 5).join(', ') || 'aucun'}.`,
    };
  }

  // Comparaison stricte normalisée
  if (normalizedDetected === normalizedExpected) {
    return {
      status: 'conforme',
      detected,
      normalizedExpected,
      normalizedDetected,
      confidence: 0.98,
      explication: `Numéro de bordereau vérifié : ${normalizedExpected} retrouvé exactement dans le document.`,
    };
  }

  // Comparaison sans séparateurs
  const strippedExpected = normalizedExpected.replace(/[^A-Z0-9]/g, '');
  const strippedDetected = normalizedDetected.replace(/[^A-Z0-9]/g, '');
  if (strippedExpected === strippedDetected) {
    return {
      status: 'conforme',
      detected,
      normalizedExpected,
      normalizedDetected,
      confidence: 0.92,
      explication: `Numéro retrouvé avec variante d'écriture (séparateurs) : saisi ${normalizedExpected} ↔ détecté ${normalizedDetected}.`,
    };
  }
  // Tolérance OCR O↔0 (fréquent sur bordereau 200A vs 20OA)
  const oToZero = (s: string) => s.replace(/O/g, '0');
  if (oToZero(strippedExpected) === oToZero(strippedDetected)) {
    return {
      status: 'a_verifier',
      detected,
      normalizedExpected,
      normalizedDetected,
      confidence: 0.75,
      explication: `Numéro probablement correspondant avec confusion O/0 : saisi ${normalizedExpected} ↔ détecté ${normalizedDetected} (variante OCR). Vérification manuelle recommandée.`,
    };
  }

  // Similarité élevée -> à vérifier (OCR incertitude 1-2 caractères)
  const sim = similarityRatio(strippedExpected, strippedDetected);
  if (sim >= 0.85 && Math.abs(strippedExpected.length - strippedDetected.length) <= 2) {
    return {
      status: 'a_verifier',
      detected,
      normalizedExpected,
      normalizedDetected,
      confidence: 0.6,
      explication: `Numéro probablement correspondant mais incertitude OCR (similarité ${(sim * 100).toFixed(0)}%) : saisi ${normalizedExpected} ↔ détecté ${normalizedDetected}. Vérification manuelle recommandée.`,
    };
  }

  return {
    status: 'non_conforme',
    detected,
    normalizedExpected,
    normalizedDetected,
    confidence: 0.85,
    explication: `Incohérence : saisi ${normalizedExpected} ≠ détecté ${normalizedDetected} (confiance ${(sim * 100).toFixed(0)}%).`,
  };
}
