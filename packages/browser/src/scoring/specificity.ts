import { lexiconFor } from './lexicon';
import { countAll, countDigitGroups, countDistinct, countMidSentenceCapitals, lowerWords } from './features';
import { dimensionResult, type DimensionResult, type DimensionScorer, type ScoringInput } from './types';

/**
 * Specificity (0..20):
 * - base 2 for any text
 * - numbers (digit groups in any script + number words): +6 for the first, +3 for the second
 * - named things (capitalised words mid-sentence): +3 each, up to +6
 * - first-person detail ("I", "my", "maine", "मैंने"): +4, a lived story is concrete
 * - vague words ("very", "things", "kuch", "बहुत"): -3 each, up to -9
 */
export class SpecificityScorer implements DimensionScorer {
  public readonly key = 'specificity' as const;

  public score(input: ScoringInput): DimensionResult {
    const lexicon = lexiconFor(input.language);
    const words = lowerWords(input.words);
    const numbers = countDigitGroups(input.text) + countAll(words, lexicon.numberWords);
    const numberPoints = numbers === 0 ? 0 : numbers === 1 ? 6 : 9;
    const named = Math.min(countMidSentenceCapitals(input.text), 2) * 3;
    const personal = countDistinct(words, lexicon.personal) > 0 ? 4 : 0;
    const vague = Math.min(countAll(words, lexicon.vague), 3) * 3;
    return dimensionResult(
      this.key,
      2 + numberPoints + named + personal - vague,
      'Be specific: add a real number, a name or a concrete detail instead of vague words.',
    );
  }
}
