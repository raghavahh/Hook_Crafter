import { lexiconFor } from './lexicon';
import { countDistinct, countPhrases, lowerWords } from './features';
import { dimensionResult, type DimensionResult, type DimensionScorer, type ScoringInput } from './types';

/**
 * Curiosity (0..20):
 * - a question mark: +6
 * - contrast / curiosity words: +4 each, up to 2 distinct (+8)
 * - open-loop phrases ("here's", "nobody tells you"): +6 for the first, +3 for the second
 * - trailing ":" or "..." / "…" (teases what comes next): +4
 */
export class CuriosityScorer implements DimensionScorer {
  public readonly key = 'curiosity' as const;

  public score(input: ScoringInput): DimensionResult {
    const lexicon = lexiconFor(input.language);
    const text = input.text.trim();
    const question = /[?？]/u.test(text) ? 6 : 0;
    const contrast = Math.min(countDistinct(lowerWords(input.words), lexicon.curiosity), 2) * 4;
    const loops = countPhrases(text, lexicon.openLoops);
    const loopPoints = loops === 0 ? 0 : loops === 1 ? 6 : 9;
    const tease = /(?::|\.\.\.|…)$/u.test(text) ? 4 : 0;
    return dimensionResult(
      this.key,
      question + contrast + loopPoints + tease,
      'Open a loop: ask a question, add a contrast ("but", "instead") or tease what comes next.',
    );
  }
}
