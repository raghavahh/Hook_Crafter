import { graphemes } from '@hook/domain';

const ELLIPSIS = '...';

/** Splits a word longer than `max` graphemes into `max`-sized chunks. */
function chunkWord(word: string, max: number): string[] {
  const parts = graphemes(word);
  if (parts.length <= max) return [word];
  const chunks: string[] = [];
  for (let i = 0; i < parts.length; i += max) chunks.push(parts.slice(i, i + max).join(''));
  return chunks;
}

/** Greedy word wrap of one paragraph (no newlines) into lines of at most `max` graphemes. */
function wrapParagraph(paragraph: string, max: number): string[] {
  const lines: string[] = [];
  let line = '';
  let lineLength = 0;
  for (const word of paragraph.split(/\s+/u).filter((w) => w !== '').flatMap((w) => chunkWord(w, max))) {
    const wordLength = graphemes(word).length;
    if (lineLength > 0 && lineLength + 1 + wordLength <= max) {
      line += ` ${word}`;
      lineLength += 1 + wordLength;
      continue;
    }
    if (lineLength > 0) lines.push(line);
    line = word;
    lineLength = wordLength;
  }
  if (lineLength > 0) lines.push(line);
  return lines;
}

/** Shortens `line` so that it plus "..." fits in `max` graphemes. */
function withEllipsis(line: string, max: number): string {
  const room = Math.max(0, max - ELLIPSIS.length);
  const kept = graphemes(line).slice(0, room).join('').trimEnd();
  return `${kept}${ELLIPSIS}`;
}

/**
 * Pure, grapheme-aware word wrap for the share card.
 * Newlines start a new line; blank lines are dropped. When the text needs more than
 * `maxLines` lines, the last line ends with "..." (still within `maxCharsPerLine`).
 */
export function wrapText(text: string, maxCharsPerLine: number, maxLines: number): string[] {
  const max = Math.max(1, Math.floor(maxCharsPerLine));
  const limit = Math.floor(maxLines);
  if (limit < 1) return [];
  const lines = text.split('\n').flatMap((paragraph) => wrapParagraph(paragraph, max));
  if (lines.length <= limit) return lines;
  const kept = lines.slice(0, limit);
  const last = kept[limit - 1] ?? '';
  kept[limit - 1] = withEllipsis(last, max);
  return kept;
}
