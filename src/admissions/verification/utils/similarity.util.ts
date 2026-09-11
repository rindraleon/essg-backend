import { normalizeText, tokenize } from './normalization.util';

export function levenshtein(a: string, b: string): number {
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;
  const matrix = Array.from({ length: al + 1 }, () => new Array<number>(bl + 1).fill(0));
  for (let i = 0; i <= al; i++) matrix[i][0] = i;
  for (let j = 0; j <= bl; j++) matrix[0][j] = j;
  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[al][bl];
}

export function similarityRatio(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const distance = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - distance / maxLen;
}

export function jaccardSimilarity(aTokens: string[], bTokens: string[]): number {
  if (aTokens.length === 0 && bTokens.length === 0) return 1;
  const setA = new Set(aTokens);
  const setB = new Set(bTokens);
  const intersection = [...setA].filter((t) => setB.has(t)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

export function diceCoefficient(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const bigrams = (s: string) => {
    const res = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) res.add(s.slice(i, i + 2));
    return res;
  };
  const aBigrams = bigrams(a);
  const bBigrams = bigrams(b);
  const intersection = [...aBigrams].filter((x) => bBigrams.has(x)).length;
  return (2 * intersection) / (aBigrams.size + bBigrams.size);
}

export interface NameMatchResult {
  detected: string | null;
  similarity: number;
  tokenSimilarity: number;
  confidence: number;
  isExact: boolean;
  isPartial: boolean;
}

export function compareNames(expected: string, text: string): NameMatchResult {
  const normExpected = normalizeText(expected);
  const normText = normalizeText(text);
  if (!normExpected)
    return {
      detected: null,
      similarity: 0,
      tokenSimilarity: 0,
      confidence: 0,
      isExact: false,
      isPartial: false,
    };
  if (!normText)
    return {
      detected: null,
      similarity: 0,
      tokenSimilarity: 0,
      confidence: 0,
      isExact: false,
      isPartial: false,
    };

  // Recherche exacte insensible à l'ordre via tokens triés
  const expectedTokens = tokenize(normExpected);
  const textTokens = tokenize(normText);

  // Si tous les tokens attendus sont dans le texte, c'est une correspondance forte (ordre indifférent)
  const allTokensPresent = expectedTokens.every((t) => textTokens.includes(t));
  if (allTokensPresent) {
    const tokenSim = jaccardSimilarity(expectedTokens, textTokens);
    // Si exactement les mêmes tokens (peut-être ordre différent), similarity 1
    const sortedExpected = expectedTokens
      .slice()
      .sort((a, b) => a.localeCompare(b))
      .join(' ');
    const sortedTextWindow = findBestTokenWindow(textTokens, expectedTokens);
    const ratio = similarityRatio(sortedExpected, sortedTextWindow);
    const confidence = 0.95 + tokenSim * 0.05; // 0.95-1.0
    return {
      detected: expectedTokens.join(' '),
      similarity: ratio,
      tokenSimilarity: tokenSim,
      confidence,
      isExact: true,
      isPartial: false,
    };
  }

  // Recherche du meilleur sous-ensemble : pour chaque fenêtre de taille expectedTokens dans textTokens, comparer
  let bestSim = 0;
  let bestTokenSim = 0;
  let bestWindow = '';
  const windowSize = expectedTokens.length;
  for (let i = 0; i <= textTokens.length - windowSize; i++) {
    const windowTokens = textTokens.slice(i, i + windowSize);
    const windowStr = windowTokens.join(' ');
    const sim = similarityRatio(normExpected, windowStr);
    const tokenSim = jaccardSimilarity(expectedTokens, windowTokens);
    const combined = sim * 0.6 + tokenSim * 0.4;
    if (combined > bestSim) {
      bestSim = combined;
      bestTokenSim = tokenSim;
      bestWindow = windowStr;
    }
  }
  // Si pas de fenêtre trouvée, comparer globalement
  if (!bestWindow) {
    const sim = similarityRatio(normExpected, normText.slice(0, normExpected.length + 20));
    bestSim = sim;
    bestWindow = normText.slice(0, 80);
  }

  const isPartial = expectedTokens.some((t) => textTokens.includes(t));
  return {
    detected: bestWindow || null,
    similarity: bestSim,
    tokenSimilarity: bestTokenSim,
    confidence: bestSim,
    isExact: false,
    isPartial,
  };
}

function findBestTokenWindow(textTokens: string[], expectedTokens: string[]): string {
  let best = '';
  let bestSim = -1;
  const windowSize = expectedTokens.length;
  const sortedExpected = expectedTokens
    .slice()
    .sort((a, b) => a.localeCompare(b))
    .join(' ');
  for (let i = 0; i <= textTokens.length - windowSize; i++) {
    const windowTokens = textTokens.slice(i, i + windowSize);
    const sortedWindow = windowTokens
      .slice()
      .sort((a, b) => a.localeCompare(b))
      .join(' ');
    const sim = similarityRatio(sortedExpected, sortedWindow);
    if (sim > bestSim) {
      bestSim = sim;
      best = sortedWindow;
    }
  }
  return best || textTokens.slice(0, windowSize).join(' ');
}

export function compareCentres(
  expected: string,
  extractedText: string,
): { similarity: number; confidence: number; detectedSnippet: string | null } {
  const normExpected = normalizeText(expected);
  const normText = normalizeText(extractedText);
  if (!normExpected || !normText) return { similarity: 0, confidence: 0, detectedSnippet: null };

  // Recherche exacte
  if (normText.includes(normExpected)) {
    return { similarity: 1, confidence: 0.99, detectedSnippet: expected };
  }

  // Recherche par tokens
  const expectedTokens = tokenize(normExpected);
  const textTokens = tokenize(normText);
  const jaccard = jaccardSimilarity(expectedTokens, textTokens);

  // Recherche du meilleur segment de taille proche
  let bestSim = 0;
  let bestSnippet = '';
  const expectedLen = normExpected.length;
  // Sliding window sur le texte normalisé par caractères
  const step = Math.max(5, Math.floor(expectedLen / 3));
  for (let i = 0; i < normText.length; i += step) {
    const snippet = normText.slice(i, i + expectedLen + 20);
    const sim = similarityRatio(normExpected, snippet.slice(0, expectedLen + 10));
    const dice = diceCoefficient(normExpected, snippet.slice(0, expectedLen));
    const combined = sim * 0.5 + dice * 0.3 + jaccard * 0.2;
    if (combined > bestSim) {
      bestSim = combined;
      bestSnippet = snippet.slice(0, 80).trim();
    }
    if (i > normText.length - expectedLen) break;
  }

  // Améliorer avec fenêtre token
  for (let i = 0; i <= textTokens.length - expectedTokens.length; i++) {
    const windowTokens = textTokens.slice(i, i + expectedTokens.length + 2);
    const windowStr = windowTokens.join(' ');
    const sim = similarityRatio(normExpected, windowStr);
    if (sim > bestSim) {
      bestSim = sim;
      bestSnippet = windowStr;
    }
  }

  return {
    similarity: Math.min(1, bestSim),
    confidence: Math.min(1, bestSim),
    detectedSnippet: bestSnippet || null,
  };
}

export function compareBacNumbers(
  expected: string,
  text: string,
): {
  status: 'conforme' | 'a_verifier' | 'non_conforme' | 'non_detecte';
  detected: string | null;
  similarity: number;
  confidence: number;
} {
  const cleanExpected = expected.replace(/\D/g, '');
  if (!cleanExpected)
    return { status: 'non_detecte', detected: null, similarity: 0, confidence: 0 };
  const digitMatches: string[] = text.match(/\d{3,20}/g) ?? [];
  const digitSequences = digitMatches.map((s) => s.replace(/\D/g, ''));
  if (digitSequences.length === 0)
    return { status: 'non_detecte', detected: null, similarity: 0, confidence: 0 };

  let best: { seq: string; dist: number; sim: number } | null = null;
  for (const seq of digitSequences) {
    const dist = levenshtein(cleanExpected, seq);
    const sim = 1 - dist / Math.max(cleanExpected.length, seq.length);
    if (!best || sim > best.sim) best = { seq, dist, sim };
  }
  if (!best) return { status: 'non_detecte', detected: null, similarity: 0, confidence: 0 };

  if (best.seq === cleanExpected)
    return { status: 'conforme', detected: best.seq, similarity: 1, confidence: 0.99 };
  if (best.dist <= 2 && best.sim >= 0.7) {
    // OCR incertitude: un ou deux caractères mal interprétés
    return { status: 'a_verifier', detected: best.seq, similarity: best.sim, confidence: 0.65 };
  }
  // Si un numéro est trouvé mais différent => non conforme (même si très différent, on signale l'incompatibilité)
  if (best.seq) {
    return { status: 'non_conforme', detected: best.seq, similarity: best.sim, confidence: 0.85 };
  }
  return { status: 'non_detecte', detected: null, similarity: best.sim, confidence: 0.3 };
}

type BordereauResult = {
  status: 'conforme' | 'a_verifier' | 'non_conforme' | 'non_detecte';
  detected: string | null;
  confidence: number;
};

function findBestBordereauCandidate(
  expected: string,
  candidates: string[],
): { candidate: string | null; similarity: number } {
  let bestSimilarity = 0;
  let bestCandidate: string | null = null;
  for (const candidate of candidates) {
    const similarity = similarityRatio(expected, candidate);
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestCandidate = candidate;
    }
  }
  return { candidate: bestCandidate, similarity: bestSimilarity };
}

function compareBordereauFallback(expected: string, text: string): BordereauResult {
  const candidates: string[] = text.match(/[A-Z0-9\-_/.]{6,20}/g) ?? [];
  const normalizedCandidates = candidates.map((candidate) => candidate.replace(/[^A-Z0-9]/g, ''));
  const best = findBestBordereauCandidate(expected, normalizedCandidates);
  if (best.candidate && best.similarity > 0.7) {
    return { status: 'non_conforme', detected: best.candidate.trim(), confidence: 0.75 };
  }
  return { status: 'non_detecte', detected: null, confidence: 0 };
}

function compareBordereauCandidates(expected: string, candidates: string[]): BordereauResult {
  const best = findBestBordereauCandidate(expected, candidates);
  if (!best.candidate) return { status: 'non_detecte', detected: null, confidence: 0 };
  if (best.similarity >= 0.85)
    return { status: 'a_verifier', detected: best.candidate, confidence: 0.6 };
  return { status: 'non_conforme', detected: best.candidate, confidence: 0.8 };
}

export function compareBordereau(expected: string, text: string): BordereauResult {
  const normExpected = expected.trim().toUpperCase().replace(/\s+/g, '');
  const normText = text.toUpperCase().replace(/\s+/g, '');
  if (!normExpected) return { status: 'non_detecte', detected: null, confidence: 0 };
  if (!normText) return { status: 'non_detecte', detected: null, confidence: 0 };

  if (normText.includes(normExpected)) {
    return { status: 'conforme', detected: expected, confidence: 0.99 };
  }

  // Recherche avec tolérance OCR: enlever tirets, comparer sans séparateurs
  const strippedExpected = normExpected.replace(/[^A-Z0-9]/g, '');
  const strippedText = normText.replace(/[^A-Z0-9]/g, '');
  if (strippedText.includes(strippedExpected)) {
    return { status: 'conforme', detected: expected, confidence: 0.9 };
  }

  // Essayer de trouver une référence similaire (ex: BRD-2026-001254 -> BRD2026001254)
  const bordereauPattern = /[A-Z]{2,4}[-_/\s]{0,10}\d{3,4}[-_/\s]{0,10}\d{3,6}/g;
  const candidates = normText.match(bordereauPattern) || [];
  return candidates.length === 0
    ? compareBordereauFallback(strippedExpected, normText)
    : compareBordereauCandidates(normExpected, candidates);
}
