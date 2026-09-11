
const TIMEZONE = 'Indian/Antananarivo';
const LOCALE = 'fr-FR';

const MOIS_FR = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

export type DateInput = string | Date | number | null | undefined;

export function parseDate(input: DateInput): Date | null {
  if (!input) return null;
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input;
  }
  // Si string ISO ou timestamp
  const d = new Date(input);
  if (isNaN(d.getTime())) return null;
  return d;
}

export function formatDateCourt(input: DateInput): string {
  const d = parseDate(input);
  if (!d) return '—';
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function formatDateLong(input: DateInput): string {
  const d = parseDate(input);
  if (!d) return '—';
  // Vérification manuelle pour éviter tout fallback anglais
  const day = new Intl.DateTimeFormat(LOCALE, { timeZone: TIMEZONE, day: 'numeric' }).format(d);
  const monthIndex = parseInt(
    new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, month: 'numeric' }).format(d),
    10,
  );
  const year = new Intl.DateTimeFormat(LOCALE, { timeZone: TIMEZONE, year: 'numeric' }).format(d);
  const mois = MOIS_FR[monthIndex - 1] || '';
  return `${day} ${mois} ${year}`;
}

/**
 * Format datetime court : 09/09/2026 14:30
 */
export function formatDateTimeCourt(input: DateInput): string {
  const d = parseDate(input);
  if (!d) return '—';
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/**
 * Format datetime long : 9 septembre 2026 à 14:30
 */
export function formatDateTimeLong(input: DateInput): string {
  const d = parseDate(input);
  if (!d) return '—';
  const datePart = formatDateLong(d);
  const timePart = new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
  return `${datePart} à ${timePart}`;
}

/**
 * Format ISO pour stockage/comparaison (YYYY-MM-DD)
 * Toujours en timezone Antananarivo
 */
export function formatDateISO(input: DateInput): string | null {
  const d = parseDate(input);
  if (!d) return null;
  const year = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric' }).format(d);
  const month = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, month: '2-digit' }).format(
    d,
  );
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, day: '2-digit' }).format(d);
  return `${year}-${month}-${day}`;
}

/**
 * Vérifie si une année est valide (4 chiffres, 1900-2100)
 */
export function isValidYear(value: string | null | undefined): boolean {
  if (!value) return false;
  const cleaned = value.trim();
  if (!/^\d{4}$/.test(cleaned)) return false;
  const year = parseInt(cleaned, 10);
  return year >= 1900 && year <= 2100;
}

/**
 * Normalise une date saisie pour comparaison (gère JJ/MM/AAAA, AAAA-MM-DD, DD-MM-YYYY, etc.)
 * Retourne une forme normalisée YYYY-MM-DD ou null si invalide.
 */
export function normalizeDateForComparison(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Déjà ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = parseDate(trimmed);
    return d ? formatDateISO(d) : null;
  }

  // JJ/MM/AAAA ou JJ-MM-AAAA ou JJ.MM.AAAA
  const dmyMatch = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(trimmed);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    // Validation basique
    const d = new Date(`${year}-${month}-${day}`);
    if (!isNaN(d.getTime())) {
      // Vérifier que la date n'a pas débordé (ex: 31/02)
      const check = new Date(`${year}-${month}-${day}T12:00:00`);
      const checkDay = String(check.getDate()).padStart(2, '0');
      const checkMonth = String(check.getMonth() + 1).padStart(2, '0');
      if (checkDay === day && checkMonth === month) {
        return `${year}-${month}-${day}`;
      }
    }
    return null;
  }

  // JJ mois AAAA en français : 15 avril 2002, 15/04/2002 avec mois texte
  const frenchMonthPattern =
    /^(\d{1,2})\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(\d{4})$/i;
  const frenchMatch = frenchMonthPattern.exec(trimmed.toLowerCase());
  if (frenchMatch) {
    const day = frenchMatch[1].padStart(2, '0');
    const monthName = frenchMatch[2]
      .toLowerCase()
      .replace('é', 'e')
      .replace('û', 'u')
      .replace('è', 'e');
    const monthMap: Record<string, string> = {
      janvier: '01',
      fevrier: '02',
      mars: '03',
      avril: '04',
      mai: '05',
      juin: '06',
      juillet: '07',
      aout: '08',
      septembre: '09',
      octobre: '10',
      novembre: '11',
      decembre: '12',
    };
    const month = monthMap[monthName];
    if (month) return `${frenchMatch[3]}-${month}-${day}`;
  }

  // Fallback : essayer parsing natif
  const d = parseDate(trimmed);
  return d ? formatDateISO(d) : null;
}

/**
 * Extrait toutes les dates trouvées dans un texte (multi-formats)
 * Retourne un tableau de dates normalisées YYYY-MM-DD avec leur forme originale
 */
export function extractDatesFromText(
  text: string,
): Array<{ original: string; normalized: string | null; iso: string | null }> {
  if (!text) return [];
  const results: Array<{ original: string; normalized: string | null; iso: string | null }> = [];
  const seen = new Set<string>();

  // Patterns : JJ/MM/AAAA, JJ-MM-AAAA, JJ.MM.AAAA, YYYY-MM-DD, DD mois YYYY
  const patterns: RegExp[] = [
    /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/g,
    /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/g,
    /\b(\d{1,2})\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(\d{4})\b/gi,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    // Reset regex
    pattern.lastIndex = 0;
    while ((match = pattern.exec(text)) !== null) {
      const original = match[0];
      if (seen.has(original)) continue;
      seen.add(original);
      const normalized = normalizeDateForComparison(original);
      results.push({ original, normalized, iso: normalized });
    }
  }

  return results;
}

/**
 * Compare deux dates de manière robuste (tolère formats différents)
 * Retourne objet avec statut et confiance
 */
export function compareDates(
  expected: string | null | undefined,
  extractedText: string | null | undefined,
): {
  status: 'conforme' | 'non_conforme' | 'non_detecte';
  detected: string | null;
  normalizedExpected: string | null;
  normalizedDetected: string | null;
  similarity: number;
  confidence: number;
} {
  const normExpected = normalizeDateForComparison(expected || '');
  if (!normExpected) {
    return {
      status: 'non_detecte',
      detected: null,
      normalizedExpected: null,
      normalizedDetected: null,
      similarity: 0,
      confidence: 0,
    };
  }
  if (!extractedText || extractedText.trim().length < 5) {
    return {
      status: 'non_detecte',
      detected: null,
      normalizedExpected: normExpected,
      normalizedDetected: null,
      similarity: 0,
      confidence: 0,
    };
  }

  const extractedDates = extractDatesFromText(extractedText);
  if (extractedDates.length === 0) {
    return {
      status: 'non_detecte',
      detected: null,
      normalizedExpected: normExpected,
      normalizedDetected: null,
      similarity: 0,
      confidence: 0.3,
    };
  }

  // Chercher correspondance exacte normalisée
  for (const entry of extractedDates) {
    if (entry.normalized === normExpected) {
      return {
        status: 'conforme',
        detected: entry.original,
        normalizedExpected: normExpected,
        normalizedDetected: entry.normalized,
        similarity: 1,
        confidence: 0.98,
      };
    }
  }

  // Chercher correspondance proche : même année/mois/jour mais ordre différent ? Vérifier jour/mois inversés
  const expectedParts = normExpected.split('-'); // YYYY-MM-DD
  for (const entry of extractedDates) {
    if (!entry.normalized) continue;
    const detectedParts = entry.normalized.split('-');
    // Si même composants mais jour/mois inversés (ex: 04/15/2002 vs 15/04/2002)
    if (expectedParts[0] === detectedParts[0]) {
      // Même année, vérifier si jour et mois inversés
      if (expectedParts[1] === detectedParts[2] && expectedParts[2] === detectedParts[1]) {
        return {
          status: 'non_conforme',
          detected: entry.original,
          normalizedExpected: normExpected,
          normalizedDetected: entry.normalized,
          similarity: 0.6,
          confidence: 0.85,
        };
      }
      // Même jour/mois mais année différente proche
      if (expectedParts[1] === detectedParts[1] && expectedParts[2] === detectedParts[2]) {
        return {
          status: 'non_conforme',
          detected: entry.original,
          normalizedExpected: normExpected,
          normalizedDetected: entry.normalized,
          similarity: 0.7,
          confidence: 0.9,
        };
      }
    }
  }

  // Aucune correspondance : prendre la première date trouvée comme détectée pour affichage
  const firstDetected = extractedDates[0];
  return {
    status: 'non_conforme',
    detected: firstDetected.original,
    normalizedExpected: normExpected,
    normalizedDetected: firstDetected.normalized,
    similarity: 0.4,
    confidence: 0.75,
  };
}
