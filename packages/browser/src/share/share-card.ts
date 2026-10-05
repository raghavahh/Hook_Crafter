import { TextSanitizer } from '@hook/domain';
import { wrapText } from './wrap-text';

export type ShareCardSize = 'portrait' | 'landscape';

export interface ShareCardOptions {
  readonly siteUrl: string;
  readonly fontFamily?: string;
}

export interface ShareCardInput {
  readonly score: number;
  readonly hookText: string;
  readonly size: ShareCardSize;
}

interface Layout {
  readonly width: number;
  readonly height: number;
  readonly pad: number;
  readonly scoreSize: number;
  readonly hookSize: number;
  readonly charsPerLine: number;
  readonly maxLines: number;
}

const LAYOUTS: Readonly<Record<ShareCardSize, Layout>> = Object.freeze({
  portrait: { width: 1080, height: 1350, pad: 96, scoreSize: 260, hookSize: 52, charsPerLine: 30, maxLines: 7 },
  landscape: { width: 1200, height: 627, pad: 64, scoreSize: 150, hookSize: 36, charsPerLine: 48, maxLines: 4 },
});

const COLORS = { background: '#111318', accent: '#ff7a1a', text: '#f5f5f7', muted: '#a1a1aa' } as const;

type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

interface Surface {
  readonly ctx: Context2D;
  toBlob(): Promise<Blob>;
}

function createSurface(width: number, height: number): Surface {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('Canvas 2D is not available.');
    return { ctx, toBlob: () => canvas.convertToBlob({ type: 'image/png' }) };
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('Canvas 2D is not available.');
  const toBlob = (): Promise<Blob> =>
    new Promise((resolve, reject) => {
      canvas.toBlob((blob) => (blob === null ? reject(new Error('Could not create the image.')) : resolve(blob)), 'image/png');
    });
  return { ctx, toBlob };
}

/**
 * Draws the "My hook scored 87" share card in the browser (PRD A5). Text only, no images;
 * user text goes through fillText, never HTML.
 */
export class ShareCardRenderer {
  readonly #siteUrl: string;
  readonly #font: string;

  public constructor(options: ShareCardOptions) {
    this.#siteUrl = options.siteUrl;
    this.#font = options.fontFamily ?? 'system-ui, -apple-system, "Segoe UI", "Noto Sans", "Noto Sans Devanagari", sans-serif';
  }

  public async render(input: ShareCardInput): Promise<Blob> {
    const layout = LAYOUTS[input.size];
    const score = Number.isFinite(input.score) ? Math.min(100, Math.max(0, Math.round(input.score))) : 0;
    const surface = createSurface(layout.width, layout.height);
    const { ctx } = surface;
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, layout.width, layout.height);
    ctx.textBaseline = 'top';
    const afterScore = this.#drawScore(ctx, layout, score);
    this.#drawHook(ctx, layout, input.hookText, afterScore);
    this.#text(ctx, this.#siteUrl, layout.pad, layout.height - layout.pad - 32, `500 32px ${this.#font}`, COLORS.muted);
    return await surface.toBlob();
  }

  /** Big score, "/100" and the label. Returns the y position below them. */
  #drawScore(ctx: Context2D, layout: Layout, score: number): number {
    const scoreText = String(score);
    ctx.font = `800 ${String(layout.scoreSize)}px ${this.#font}`;
    ctx.fillStyle = COLORS.accent;
    ctx.fillText(scoreText, layout.pad, layout.pad);
    const scoreWidth = ctx.measureText(scoreText).width;
    const outOfSize = Math.round(layout.scoreSize / 3);
    const outOfY = layout.pad + layout.scoreSize - outOfSize - 12;
    this.#text(ctx, '/100', layout.pad + scoreWidth + 16, outOfY, `700 ${String(outOfSize)}px ${this.#font}`, COLORS.muted);
    const labelY = layout.pad + layout.scoreSize + 24;
    const labelSize = Math.round(layout.hookSize * 0.9);
    this.#text(ctx, `My hook scored ${scoreText} 🔥`, layout.pad, labelY, `700 ${String(labelSize)}px ${this.#font}`, COLORS.text);
    return labelY + labelSize + 48;
  }

  #drawHook(ctx: Context2D, layout: Layout, hookText: string, top: number): void {
    const clean = TextSanitizer.clean(hookText).trim();
    const lines = wrapText(`“${clean}”`, layout.charsPerLine, layout.maxLines);
    const lineHeight = Math.round(layout.hookSize * 1.35);
    lines.forEach((line, index) => {
      this.#text(ctx, line, layout.pad, top + index * lineHeight, `500 ${String(layout.hookSize)}px ${this.#font}`, COLORS.text);
    });
  }

  #text(ctx: Context2D, text: string, x: number, y: number, font: string, color: string): void {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }
}
