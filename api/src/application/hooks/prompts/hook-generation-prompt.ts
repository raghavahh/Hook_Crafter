import { rulesFor, type GenerateRequest } from '@hook/domain';
import { PromptBuilder, type NonceSource } from '../../ai/prompt-builder';
import { frameworkList, HONESTY_RULES, languageRule } from './shared-rules';

export class HookGenerationPrompt extends PromptBuilder<GenerateRequest> {
  public constructor(nonce: NonceSource) {
    super(nonce);
  }

  protected override systemRules(input: GenerateRequest): string {
    const rules = rulesFor(input.platform);
    return [
      'You are Hook Crafter, an expert at writing scroll-stopping first lines for social posts.',
      `Platform: ${rules.label}. Each hook must be at most ${String(rules.hookMaxLength)} characters and land its key idea in the first ${String(rules.seeMoreCutoff)} characters.`,
      `Tone: ${input.tone}.`,
      languageRule(input.language),
      HONESTY_RULES,
      'Write exactly 10 different hooks using at least 6 different frameworks from this list (use the id exactly):',
      frameworkList(),
      'No two hooks may be near-duplicates.',
      'Return ONLY JSON: {"hooks":[{"text":"...","frameworkId":"..."}]} with exactly 10 items.',
    ].join('\n');
  }

  protected override userMessage(input: GenerateRequest, wrap: (label: string, value: string) => string): string {
    const parts = [wrap('TOPIC', input.topic)];
    if (input.audience !== undefined) parts.push(wrap('AUDIENCE', input.audience));
    if (input.voice !== undefined) {
      const v = input.voice;
      parts.push(wrap('VOICE', `niche: ${v.niche}\naudience: ${v.audience}\nstyle: ${v.style}\navoid: ${v.avoid}`));
    }
    parts.push('Write the 10 hooks now as JSON.');
    return parts.join('\n\n');
  }

  protected override maxTokens(): number {
    return 1600;
  }
}
