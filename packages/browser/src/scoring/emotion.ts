import { lexiconFor } from './lexicon';
import { countChar, countDistinct, hasEmoji, lowerWords } from './features';
import { dimensionResult, type DimensionResult, type DimensionScorer, type ScoringInput } from './types';

/**
 * Emotion (0..20):
 * - base 4 for any text
 * - power / emotion words: +6 each, up to 2 distinct (+12)
 * - one or two "!": +2; three or more: -2 (shouting reads as spam)
 * - an emoji: +2 (once)
 */
export class EmotionScorer implements DimensionScorer {
  public readonly key = 'emotion' as const;

  public score(input: ScoringInput): DimensionResult {
    const lexicon = lexiconFor(input.language);
    const power = Math.min(countDistinct(lowerWords(input.words), lexicon.power), 2) * 6;
    const bangs = countChar(input.text, '!');
    const bang = bangs === 0 ? 0 : bangs <= 2 ? 2 : -2;
    const emoji = hasEmoji(input.text) ? 2 : 0;
    return dimensionResult(
      this.key,
      4 + power + bang + emoji,
      'Add feeling: use a strong word (lost, failed, secret) or show what was at stake.',
    );
  }
}
