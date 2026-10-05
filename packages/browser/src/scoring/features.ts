import { graphemes } from '@hook/domain';
import { normaliseForMatch } from './lexicon';

/**
 * A word starts with a letter or digit; combining marks (Indic matras) and ZWNJ/ZWJ may only
 * follow it, so emoji pieces (VS16, ZWJ sequences) never become phantom words.
 * Inner apostrophes are kept ("today's").
 */
const WORD = /[\p{L}\p{N}][\p{L}\p{M}\p{N}\u200C\u200D]*(?:['’]\p{L}[\p{L}\p{M}]*)*/gu;
const DIGIT_GROUP = /\p{Nd}+(?:[.,]\p{Nd}+)*/gu;
/** Real emoji only: default emoji presentation, or a pictograph forced to emoji with VS16. ©, ®, ™ do not count. */
const EMOJI = /\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F/u;
const SENTENCE_END = /[.!?।:"“(]/u;
const TERMINATORS: ReadonlySet<string> = new Set(['.', '!', '?', '।']);
const PHRASE_NOISE = /[^\p{L}\p{M}\p{N}'\u200C\u200D-]+/gu;

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
  const haystack = ` ${normaliseForMatch(text).replace(PHRASE_NOISE, ' ')} `;
  let count = 0;
  for (const phrase of phrases) {
    const needle = ` ${phrase.replace(PHRASE_NOISE, ' ').trim()} `;
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

/**
 * The first sentence or line: the "key idea" that must land before the cut-off.
 * A single linear scan (no regex backtracking): ends at a newline, or at a run of
 * . ! ? । followed by whitespace or the end of the text.
 */
export function firstSentence(text: string): string {
  const trimmed = text.trim();
  for (let i = 0; i < trimmed.length; i += 1) {
    const ch = trimmed.charAt(i);
    if (ch === '\n') return trimmed.slice(0, i).trim();
    if (!TERMINATORS.has(ch)) continue;
    let end = i + 1;
    while (end < trimmed.length && TERMINATORS.has(trimmed.charAt(end))) end += 1;
    if (end === trimmed.length || /\s/u.test(trimmed.charAt(end))) return trimmed.slice(0, end);
    i = end - 1;
  }
  return trimmed;
}

/**
 * Words that start with a capital letter but do not start a sentence:
 * a cheap signal for named things ("Zomato", "Delhi", "Q3").
 * Linear: only the gap since the previous word is inspected.
 */
export function countMidSentenceCapitals(text: string): number {
  let count = 0;
  let previousEnd = -1;
  for (const match of text.matchAll(WORD)) {
    const word = match[0];
    const gap = text.slice(Math.max(0, previousEnd), match.index);
    const lastMark = gap.trimEnd().at(-1);
    const startsSentence =
      previousEnd < 0 || gap.includes('\n') || (lastMark !== undefined && SENTENCE_END.test(lastMark));
    previousEnd = match.index + word.length;
    if (startsSentence || !/^\p{Lu}/u.test(word) || /^I(?:['’]\p{L}+)?$/u.test(word)) continue;
    count += 1;
  }
  return count;
}
