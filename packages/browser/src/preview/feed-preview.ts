import { graphemes, rulesFor, TextSanitizer, type Platform, type PlatformRules } from '@hook/domain';

export interface FeedPreview {
  /** Shown before "…see more". */
  readonly visible: string;
  /** Behind "…see more". `visible + hidden` equals the sanitised input. */
  readonly hidden: string;
  /** True when the hidden part has any non-whitespace content. */
  readonly truncated: boolean;
  /** Cut-offs are approximate (PRD B6); the UI must say so. */
  readonly approximate: true;
}

/** How far back (in graphemes) we look for a space to avoid cutting a word in half. */
const WORD_BOUNDARY_WINDOW = 15;

const isSpace = (g: string | undefined): boolean => g !== undefined && /^\s+$/u.test(g);

/**
 * Splits text into the part a phone feed shows and the part behind "…see more".
 * Line-based AND char-based: stops after `previewLines` rendered lines (hard-wrapped at
 * `charsPerLine` graphemes) or `seeMoreCutoff` graphemes, whichever comes first.
 * Works on graphemes, so an emoji or a Devanagari conjunct is never split.
 */
export class FeedPreviewModel {
  public render(text: string, platform: Platform): FeedPreview {
    const clean = TextSanitizer.clean(text);
    const parts = graphemes(clean);
    const cut = this.#cutIndex(parts, rulesFor(platform));
    const visible = parts.slice(0, cut).join('');
    const hidden = parts.slice(cut).join('');
    return Object.freeze({ visible, hidden, truncated: hidden.trim() !== '', approximate: true });
  }

  /** Grapheme index where the hidden part starts (parts.length when nothing is hidden). */
  #cutIndex(parts: readonly string[], rules: PlatformRules): number {
    let lines = 1;
    let column = 0;
    for (let i = 0; i < parts.length; i += 1) {
      if (i >= rules.seeMoreCutoff) return this.#preferWordBoundary(parts, i);
      if (parts[i] === '\n') {
        if (lines >= rules.previewLines) return i;
        lines += 1;
        column = 0;
        continue;
      }
      if (column >= rules.charsPerLine) {
        if (lines >= rules.previewLines) return this.#preferWordBoundary(parts, i);
        lines += 1;
        column = 0;
      }
      column += 1;
    }
    return parts.length;
  }

  /** Moves a mid-word cut back to the last space within the window, if there is one. */
  #preferWordBoundary(parts: readonly string[], cut: number): number {
    if (isSpace(parts[cut]) || isSpace(parts[cut - 1])) return cut;
    const floor = Math.max(1, cut - WORD_BOUNDARY_WINDOW);
    for (let j = cut - 1; j >= floor; j -= 1) {
      if (isSpace(parts[j])) return j;
    }
    return cut;
  }
}
