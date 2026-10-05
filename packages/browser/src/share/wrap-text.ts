import { graphemes } from '@hook/domain';

const ELLIPSIS = '...';

/** Width of a string in any unit (graphemes, canvas pixels). */
export type Measure = (text: string) => number;

/** Splits a word wider than `max` into chunks that fit (at least one grapheme each, so it always progresses). */
function chunkWord(word: string, measure: Measure, max: number): string[] {
  if (measure(word) <= max) return [word];
  const chunks: string[] = [];
  let chunk = '';
  for (const g of graphemes(word)) {
    if (chunk !== '' && measure(chunk + g) > max) {
      chunks.push(chunk);
      chunk = '';
    }
    chunk += g;
  }
  if (chunk !== '') chunks.push(chunk);
  return chunks;
}

/** Greedy word wrap of one paragraph. Stops once `stopAfter` lines exist (enough to know it overflows). */
function wrapParagraph(paragraph: string, measure: Measure, max: number, stopAfter: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of paragraph.split(/\s+/u)) {
    if (word === '') continue;
    for (const piece of chunkWord(word, measure, max)) {
      const candidate = line === '' ? piece : `${line} ${piece}`;
      if (line === '' || measure(candidate) <= max) {
        line = candidate;
        continue;
      }
      lines.push(line);
      if (lines.length >= stopAfter) return lines;
      line = piece;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

/**
 * Ends `line` with "..." within `max`. When even "..." is too wide (tiny limits) the dots
 * themselves are shortened, so the result never exceeds `max` (unless one "." does not fit).
 */
function withEllipsis(line: string, measure: Measure, max: number): string {
  const kept = graphemes(line);
  while (kept.length > 0 && measure(`${kept.join('').trimEnd()}${ELLIPSIS}`) > max) kept.pop();
  if (kept.length > 0) return `${kept.join('').trimEnd()}${ELLIPSIS}`;
  let dots = ELLIPSIS;
  while (dots.length > 1 && measure(dots) > max) dots = dots.slice(1);
  return dots;
}

/**
 * Word wrap against any width measure (canvas `measureText` for the share card).
 * Newlines start a new line; blank lines are dropped. When the text needs more than
 * `maxLines` lines, the last line ends with "..." and still fits `maxWidth`.
 */
export function wrapMeasured(text: string, measure: Measure, maxWidth: number, maxLines: number): string[] {
  const limit = Math.floor(maxLines);
  if (limit < 1) return [];
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    lines.push(...wrapParagraph(paragraph, measure, maxWidth, limit + 1 - lines.length));
    if (lines.length > limit) break;
  }
  if (lines.length <= limit) return lines;
  const kept = lines.slice(0, limit);
  kept[limit - 1] = withEllipsis(kept[limit - 1] ?? '', measure, maxWidth);
  return kept;
}

/** Pure, grapheme-aware word wrap: each line has at most `maxCharsPerLine` (>= 1) graphemes. */
export function wrapText(text: string, maxCharsPerLine: number, maxLines: number): string[] {
  const max = Math.max(1, Math.floor(maxCharsPerLine));
  return wrapMeasured(text, (s) => graphemes(s).length, max, maxLines);
}
