import type { Language, Platform } from '@hook/domain';

export type DimensionKey = 'curiosity' | 'specificity' | 'emotion' | 'clarity' | 'platformFit';

export const DIMENSION_KEYS: readonly DimensionKey[] = ['curiosity', 'specificity', 'emotion', 'clarity', 'platformFit'];

export interface ScoringInput {
  /** Sanitised text (TextSanitizer.clean already applied). */
  readonly text: string;
  readonly platform: Platform;
  readonly language: Language;
  /** Word tokens in original case, in order. */
  readonly words: readonly string[];
}

export interface DimensionResult {
  readonly key: DimensionKey;
  /** Integer 0..20. */
  readonly points: number;
  /** Advice for this dimension, or null when the dimension is already at full marks. */
  readonly tip: string | null;
}

/** Strategy: one class per dimension (open/closed: a new dimension is a new class). */
export interface DimensionScorer {
  readonly key: DimensionKey;
  score(input: ScoringInput): DimensionResult;
}

export const MAX_DIMENSION_POINTS = 20;

/** Clamp to an integer in 0..20. */
export function clampPoints(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  return Math.min(MAX_DIMENSION_POINTS, Math.max(0, Math.round(raw)));
}

/** Builds a result; the tip is dropped when the dimension scored full marks. */
export function dimensionResult(key: DimensionKey, raw: number, tip: string): DimensionResult {
  const points = clampPoints(raw);
  return { key, points, tip: points < MAX_DIMENSION_POINTS ? tip : null };
}
