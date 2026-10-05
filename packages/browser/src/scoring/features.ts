import { graphemes } from '@hook/domain';
import { normaliseForMatch } from './lexicon';

/** Letters, combining marks (Indic matras), digits, ZWNJ/ZWJ; inner apostrophes kept ("today's"). */
const WORD = /[\p{L}\p{M}\p{N}‌‍]+(?:['’][\p{L}\p{M}]+)*/gu;
const DIGIT_GROUP = /\p{Nd}+(?:[.,]\p{Nd}+)*/gu;
const EMOJI = /\p{Extended_Pictographic}/u;

/** Word tokens in original case. */
export function tokenize(text: string): string[] {
  return text.match(WORD) ?? [];
}

/** Lower-cased, NFC, curly apostrophes straightened. */
export function lowerWords(words: readonly string[]): string[] {
  return words.map(normaliseForMatch);
}

/** Number of distinct words from `words` that are in `set`. */
export function countDistinct(words: readonly string[], set: ReadonlySet<string>): number {
  const hits = new Set<string>();
  for (const word of words) {
    if (set.has(word)) hits.add(word);
  }
  return hits.size;
}

/** Number of total occurrences of words from `set`. */
export function countAll(words: readonly string[], set: ReadonlySet<string>): number {
  let count = 0;
  for (const word of words) {
    if (set.has(word)) count += 1;
  }
  return count;
}

/** Number of phrases found in the text, matched on word boundaries (each phrase once). */
export function countPhrases(text: string, phrases: readonly string[]): number {
  const haystack = ` ${normaliseForMatch(text).replace(/[^\p{L}\p{M}\p{N}'‌‍-]+/gu, ' ')} `;
  let count = 0;
  for (const phrase of phrases) {
    const needle = ` ${phrase.replace(/[^\p{L}\p{M}\p{N}'‌‍-]+/gu, ' ').trim()} `;
    if (haystack.includes(needle)) count += 1;
  }
  return count;
}

export function countDigitGroups(text: string): number {
  return (text.match(DIGIT_GROUP) ?? []).length;
}

export function countChar(text: string, char: string): number {
  let count = 0;
  for (const ch of text) {
    if (ch === char) count += 1;
  }
  return count;
}

export function hasEmoji(text: string): boolean {
  return EMOJI.test(text);
}

/** Average word length in graphemes (Devanagari conjuncts count once). */
export function averageWordLength(words: readonly string[]): number {
  if (words.length === 0) return 0;
  const total = words.reduce((sum, word) => sum + graphemes(word).length, 0);
  return total / words.length;
}

/** The first sentence or line: the "key idea" that must land before the cut-off. */
export function firstSentence(text: string): string {
  const trimmed = text.trim();
  const match = /^[\s\S]*?(?:[.!?।]+(?=\s|$)|\n|$)/u.exec(trimmed);
  return (match?.[0] ?? trimmed).trim();
}

/**
 * Words that start with a capital letter but do not start a sentence:
 * a cheap signal for named things ("Zomato", "Delhi", "Q3").
 */
export function countMidSentenceCapitals(text: string): number {
  let count = 0;
  for (const match of text.matchAll(WORD)) {
    const word = match[0];
    if (!/^\p{Lu}/u.test(word) || /^I(?:['’]\p{L}+)?$/u.test(word)) continue;
    const before = text.slice(0, match.index).trimEnd();
    const startsSentence = before === '' || /[.!?।:\n"“(]$/u.test(before);
    if (!startsSentence) count += 1;
  }
  return count;
}
