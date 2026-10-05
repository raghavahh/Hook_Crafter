import { codePointLength, graphemes, rulesFor } from '@hook/domain';
import { firstSentence } from './features';
import { dimensionResult, type DimensionResult, type DimensionScorer, type ScoringInput } from './types';

/**
 * Platform Fit (0..20), using the APPROXIMATE cut-offs in PlatformRules:
 * - key idea (first sentence or line) fully before `seeMoreCutoff` graphemes: +12;
 *   longer: 12 scaled by cutoff / length (rounded)
 * - whole hook within `hookMaxLength` code points: +8; within 125%: +4; longer: 0
 */
export class PlatformFitScorer implements DimensionScorer {
  public readonly key = 'platformFit' as const;

  public score(input: ScoringInput): DimensionResult {
    const rules = rulesFor(input.platform);
    const keyIdeaLength = graphemes(firstSentence(input.text)).length;
    const landing = keyIdeaLength <= rules.seeMoreCutoff ? 12 : Math.round((12 * rules.seeMoreCutoff) / keyIdeaLength);
    const total = codePointLength(input.text.trim());
    const fits = total <= rules.hookMaxLength ? 8 : total <= rules.hookMaxLength * 1.25 ? 4 : 0;
    return dimensionResult(
      this.key,
      landing + fits,
      `Land the key idea in the first ${String(rules.seeMoreCutoff)} characters and keep the hook under ${String(rules.hookMaxLength)}.`,
    );
  }
}
