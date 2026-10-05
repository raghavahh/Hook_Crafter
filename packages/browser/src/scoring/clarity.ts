import { lexiconFor } from './lexicon';
import { averageWordLength, countAll, countPhrases, lowerWords } from './features';
import { dimensionResult, type DimensionResult, type DimensionScorer, type ScoringInput } from './types';

/**
 * Clarity (0..20):
 * - base 4 for any text
 * - word count: 6-20 words +10, 3-5 or 21-30 words +5, otherwise +1
 * - average word length (graphemes): <= 6 +6, <= 8 +3, longer 0
 * - clichés: -6 each, up to -12; jargon: -3 each, up to -9
 */
export class ClarityScorer implements DimensionScorer {
  public readonly key = 'clarity' as const;

  public score(input: ScoringInput): DimensionResult {
    const lexicon = lexiconFor(input.language);
    const length = this.#lengthPoints(input.words.length);
    const average = averageWordLength(input.words);
    const ease = average <= 6 ? 6 : average <= 8 ? 3 : 0;
    const cliches = Math.min(countPhrases(input.text, lexicon.cliches), 2) * 6;
    const jargon = Math.min(countAll(lowerWords(input.words), lexicon.jargon), 3) * 3;
    return dimensionResult(
      this.key,
      4 + length + ease - cliches - jargon,
      'Make it clearer: aim for 6-20 short words and cut clichés and jargon.',
    );
  }

  #lengthPoints(count: number): number {
    if (count >= 6 && count <= 20) return 10;
    if ((count >= 3 && count <= 5) || (count >= 21 && count <= 30)) return 5;
    return 1;
  }
}
