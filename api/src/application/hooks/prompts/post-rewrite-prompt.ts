import { rulesFor, type RewritePostRequest } from '@hook/domain';
import { PromptBuilder, type NonceSource } from '../../ai/prompt-builder';
import { frameworkList, HONESTY_RULES, languageRule } from './shared-rules';

export class PostRewritePrompt extends PromptBuilder<RewritePostRequest> {
  public constructor(nonce: NonceSource) {
    super(nonce);
  }

  protected override systemRules(input: RewritePostRequest): string {
    const rules = rulesFor(input.platform);
    return [
      'You rewrite social posts so the first line stops the scroll and the body is easy to read.',
      `Platform: ${rules.label}. The opening line must be at most ${String(rules.hookMaxLength)} characters.`,
      "Keep the author's meaning, facts and voice. Improve structure: short paragraphs, one idea per line, a clear ending.",
      'Do not add facts, numbers, names or claims that are not in the original post.',
      languageRule(input.language),
      HONESTY_RULES,
      'Pick the framework id for the new opening line from this list:',
      frameworkList(),
      'Return ONLY JSON: {"post":"...","hookFrameworkId":"..."}. Max 5000 characters for post.',
    ].join('\n');
  }

  protected override userMessage(input: RewritePostRequest, wrap: (label: string, value: string) => string): string {
    return `${wrap('POST', input.post)}\n\nRewrite it now as JSON.`;
  }

  protected override maxTokens(): number {
    return 2400;
  }
}
