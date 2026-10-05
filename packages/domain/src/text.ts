/**
 * Unicode safety (PRD B4 Flow 1, T11 / S-33).
 * - NFC normalisation
 * - strips bidi controls (U+202A to U+202E, U+2066 to U+2069, LRM/RLM/ALM), U+200B and U+FEFF
 * - strips C0/C1 control characters except newline and tab
 * - KEEPS U+200C/U+200D (ZWNJ/ZWJ), which Indic scripts need
 */
const BIDI_AND_INVISIBLE = /[‪-‮⁦-⁩​‎‏؜﻿]/gu;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/gu;

export class TextSanitizer {
  private constructor() {}

  public static clean(input: string): string {
    return input
      .normalize('NFC')
      .replace(/\r\n?/gu, '\n')
      .replace(BIDI_AND_INVISIBLE, '')
      .replace(CONTROL, '');
  }
}

/** Length in Unicode code points: the same unit Postgres char_length() uses. */
export function codePointLength(text: string): number {
  let count = 0;
  for (const _ of text) count += 1;
  return count;
}

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** User-perceived characters (emoji and Devanagari conjuncts count as one). */
export function graphemes(text: string): string[] {
  return Array.from(segmenter.segment(text), (s) => s.segment);
}

/** Share of letters in `text` that belong to `script` (0 to 1). Used for the Devanagari 80% check. */
export function scriptShare(text: string, script: RegExp): number {
  const letters = text.match(/\p{L}/gu) ?? [];
  if (letters.length === 0) return 0;
  const inScript = letters.filter((ch) => script.test(ch)).length;
  return inScript / letters.length;
}

export const DEVANAGARI = /\p{Script=Devanagari}/u;
