import type { Language } from '@hook/domain';

/**
 * Honest hooks (PRD A8, T10 / S-32): every number in the output must appear in the input,
 * or be a placeholder like [X]. Handles ASCII and Devanagari digits, separators, k/L/cr
 * suffixes and number words. "one"/"ek"/"एक" are ignored because they work as articles.
 * Hinglish words ("do", "teen", "char"...) collide with English, so they only count for Hinglish.
 */
const ENGLISH: Readonly<Record<string, number>> = {
  two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, fifty: 50, hundred: 100,
  thousand: 1000, million: 1_000_000, billion: 1_000_000_000, lakh: 100_000, lakhs: 100_000,
  crore: 10_000_000, crores: 10_000_000, dozen: 12,
};

const HINGLISH: Readonly<Record<string, number>> = {
  do: 2, teen: 3, char: 4, chaar: 4, paanch: 5, panch: 5, chhe: 6, saat: 7, aath: 8, nau: 9, das: 10,
  bees: 20, pachaas: 50, sau: 100, hazaar: 1000, hazar: 1000,
};

const HINDI: Readonly<Record<string, number>> = {
  'दो': 2, 'तीन': 3, 'चार': 4, 'पांच': 5, 'पाँच': 5, 'छह': 6, 'सात': 7, 'आठ': 8, 'नौ': 9, 'दस': 10,
  'बीस': 20, 'पचास': 50, 'सौ': 100, 'हज़ार': 1000, 'हजार': 1000, 'लाख': 100_000, 'करोड़': 10_000_000,
};

const SUFFIX: Readonly<Record<string, number>> = { k: 1000, l: 100_000, cr: 10_000_000, m: 1_000_000, x: 1 };

function wordsFor(language: Language): Readonly<Record<string, number>> {
  return language === 'hinglish' ? { ...ENGLISH, ...HINDI, ...HINGLISH } : { ...ENGLISH, ...HINDI };
}

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[०-९]/gu, (d) => String(d.charCodeAt(0) - 0x0966))
    .replace(/\[[^\]\n]{1,20}\]/gu, ' ');
}

/** All numeric values mentioned in `text`. */
export function extractNumbers(text: string, language: Language): Set<number> {
  const clean = normalise(text);
  const values = new Set<number>();
  for (const match of clean.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(k|l|cr|m|x)?(?![\p{L}\d])/gu)) {
    const raw = match[1];
    if (raw === undefined) continue;
    const base = Number(raw.replace(/,/gu, ''));
    if (!Number.isFinite(base)) continue;
    const suffix = match[2];
    values.add(suffix === undefined ? base : base * (SUFFIX[suffix] ?? 1));
  }
  const words = wordsFor(language);
  for (const token of clean.split(/[^\p{L}\p{M}]+/u)) {
    const value = words[token];
    if (value !== undefined) values.add(value);
  }
  return values;
}

export class NumberProvenanceCheck {
  readonly #allowed: Set<number>;
  readonly #language: Language;

  public constructor(input: string, language: Language) {
    this.#language = language;
    this.#allowed = extractNumbers(input, language);
  }

  /** Numbers in `output` that never appeared in the input. Empty = honest. */
  public inventedNumbers(output: string): number[] {
    return [...extractNumbers(output, this.#language)].filter((n) => !this.#allowed.has(n));
  }

  public isHonest(output: string): boolean {
    return this.inventedNumbers(output).length === 0;
  }
}
