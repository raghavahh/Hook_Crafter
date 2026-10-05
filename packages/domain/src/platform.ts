import { z } from 'zod';
import { InvariantViolation } from './errors';

export const PLATFORMS = ['linkedin', 'x', 'instagram_caption', 'shorts_title', 'reels_script'] as const;
export type Platform = (typeof PLATFORMS)[number];
export const PlatformSchema = z.enum(PLATFORMS);

/** Platforms `/v1/hooks/generate` accepts. Reels has its own route (ADR-0003). */
export const GENERATE_PLATFORMS = ['linkedin', 'x', 'instagram_caption', 'shorts_title'] as const;
export type GeneratePlatform = (typeof GENERATE_PLATFORMS)[number];
export const GeneratePlatformSchema = z.enum(GENERATE_PLATFORMS);

interface PlatformRulesProps {
  readonly id: Platform;
  readonly label: string;
  /** Hard cap for one hook on this platform (code points). */
  readonly hookMaxLength: number;
  /** APPROXIMATE character cut-off before "…see more". Verify on real phones before launch. */
  readonly seeMoreCutoff: number;
  /** APPROXIMATE number of lines shown before "…see more" on a phone. */
  readonly previewLines: number;
  /** APPROXIMATE characters per rendered line on a phone. */
  readonly charsPerLine: number;
}

/** Immutable, self-validating platform config. */
export class PlatformRules {
  public readonly id: Platform;
  public readonly label: string;
  public readonly hookMaxLength: number;
  public readonly seeMoreCutoff: number;
  public readonly previewLines: number;
  public readonly charsPerLine: number;

  private constructor(props: PlatformRulesProps) {
    this.id = props.id;
    this.label = props.label;
    this.hookMaxLength = props.hookMaxLength;
    this.seeMoreCutoff = props.seeMoreCutoff;
    this.previewLines = props.previewLines;
    this.charsPerLine = props.charsPerLine;
    Object.freeze(this);
  }

  public static create(props: PlatformRulesProps): PlatformRules {
    const positive = [props.hookMaxLength, props.seeMoreCutoff, props.previewLines, props.charsPerLine];
    if (!positive.every((n) => Number.isInteger(n) && n > 0)) {
      throw new InvariantViolation(`PlatformRules for ${props.id} must use positive integers`);
    }
    return new PlatformRules(props);
  }
}

/**
 * Cut-offs are approximate and live in config only (PRD B6).
 * Labels are generic "-style" names: no real logos or trademarks.
 */
export const PLATFORM_RULES: Readonly<Record<Platform, PlatformRules>> = Object.freeze({
  linkedin: PlatformRules.create({
    id: 'linkedin',
    label: 'LinkedIn-style post',
    hookMaxLength: 220,
    seeMoreCutoff: 210,
    previewLines: 3,
    charsPerLine: 48,
  }),
  x: PlatformRules.create({
    id: 'x',
    label: 'X-style post',
    hookMaxLength: 280,
    seeMoreCutoff: 280,
    previewLines: 8,
    charsPerLine: 40,
  }),
  instagram_caption: PlatformRules.create({
    id: 'instagram_caption',
    label: 'Instagram-style caption',
    hookMaxLength: 150,
    seeMoreCutoff: 125,
    previewLines: 2,
    charsPerLine: 44,
  }),
  shorts_title: PlatformRules.create({
    id: 'shorts_title',
    label: 'Shorts-style title',
    hookMaxLength: 100,
    seeMoreCutoff: 70,
    previewLines: 2,
    charsPerLine: 36,
  }),
  reels_script: PlatformRules.create({
    id: 'reels_script',
    label: 'Reels-style opening',
    hookMaxLength: 150,
    seeMoreCutoff: 125,
    previewLines: 2,
    charsPerLine: 32,
  }),
});

export function rulesFor(platform: Platform): PlatformRules {
  return PLATFORM_RULES[platform];
}
