import { TextSanitizer, type Language, type Platform } from '@hook/domain';
import { ClarityScorer } from './clarity';
import { CuriosityScorer } from './curiosity';
import { EmotionScorer } from './emotion';
import { tokenize } from './features';
import { PlatformFitScorer } from './platform-fit';
import { SpecificityScorer } from './specificity';
import { DIMENSION_KEYS, clampPoints, type DimensionKey, type DimensionResult, type DimensionScorer } from './types';

export interface HookScore {
  /** 0..100. */
  readonly total: number;
  readonly dimensions: Readonly<Record<DimensionKey, number>>;
  /** 2-3 tips from the weakest dimensions. */
  readonly tips: readonly string[];
}

export const EMPTY_TEXT_TIP = 'Type a first line to get a score.';

/** Used only when fewer than two dimensions have room to improve. */
const POLISH_TIPS: readonly string[] = [
  'Strong hook. Write two more angles and keep the one with the best score.',
  'Read it aloud: if you would stop scrolling for it, ship it.',
];

/** A third tip is shown only when that dimension is clearly weak. */
const THIRD_TIP_BELOW = 12;

function defaultScorers(): readonly DimensionScorer[] {
  return [new CuriosityScorer(), new SpecificityScorer(), new EmotionScorer(), new ClarityScorer(), new PlatformFitScorer()];
}

function zeroDimensions(): Record<DimensionKey, number> {
  return { curiosity: 0, specificity: 0, emotion: 0, clarity: 0, platformFit: 0 };
}

/**
 * Hook Score (PRD B4 Flow 1): composes DimensionScorer strategies.
 * Pure and deterministic: the same (text, platform, language) always gives the same score.
 */
export class HookScorer {
  readonly #scorers: readonly DimensionScorer[];

  public constructor(scorers?: readonly DimensionScorer[]) {
    this.#scorers = Object.freeze([...(scorers ?? defaultScorers())]);
  }

  public score(text: string, platform: Platform, language: Language): HookScore {
    const clean = TextSanitizer.clean(text);
    if (clean.trim() === '') {
      return Object.freeze({ total: 0, dimensions: Object.freeze(zeroDimensions()), tips: Object.freeze([EMPTY_TEXT_TIP]) });
    }
    const input = { text: clean, platform, language, words: tokenize(clean) };
    const results = this.#scorers.map((scorer) => scorer.score(input));
    const dimensions = zeroDimensions();
    for (const result of results) dimensions[result.key] = clampPoints(result.points);
    const total = Math.min(100, DIMENSION_KEYS.reduce((sum, key) => sum + dimensions[key], 0));
    return Object.freeze({ total, dimensions: Object.freeze(dimensions), tips: Object.freeze(this.#tips(results)) });
  }

  #tips(results: readonly DimensionResult[]): string[] {
    const weakest = results
      .map((result, order) => ({ result, order }))
      .filter(({ result }) => result.tip !== null)
      .sort((a, b) => a.result.points - b.result.points || a.order - b.order)
      .map(({ result }) => result);
    const third = weakest[2];
    const take = third !== undefined && third.points < THIRD_TIP_BELOW ? 3 : 2;
    const tips = weakest.slice(0, take).flatMap((result) => (result.tip === null ? [] : [result.tip]));
    for (const polish of POLISH_TIPS) {
      if (tips.length >= 2) break;
      tips.push(polish);
    }
    return tips;
  }
}
