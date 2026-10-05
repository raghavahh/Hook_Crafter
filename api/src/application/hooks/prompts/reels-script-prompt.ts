import type { ReelsRequest } from '@hook/domain';
import { PromptBuilder, type NonceSource } from '../../ai/prompt-builder';
import { HONESTY_RULES, languageRule } from './shared-rules';

export class ReelsScriptPrompt extends PromptBuilder<ReelsRequest> {
  public constructor(nonce: NonceSource) {
    super(nonce);
  }

  protected override systemRules(input: ReelsRequest): string {
    return [
      'You write the first 3 seconds of short vertical videos (Reels/Shorts) and a beat plan.',
      `Video length: ${String(input.durationSec)} seconds.`,
      'spokenLine: what the creator says in the first 3 seconds (max 150 characters).',
      'onScreenText: bold caption shown on screen (max 60 characters).',
      'visualIdea: what the viewer sees in the first 3 seconds (max 200 characters).',
      `beats: 3 to 6 items {"atSec": integer 0..${String(input.durationSec)}, "action": "..."} in ascending order, starting at 0.`,
      languageRule(input.language),
      HONESTY_RULES,
      'Return ONLY JSON: {"spokenLine":"...","onScreenText":"...","visualIdea":"...","beats":[...]}.',
    ].join('\n');
  }

  protected override userMessage(input: ReelsRequest, wrap: (label: string, value: string) => string): string {
    return `${wrap('TOPIC', input.topic)}\n\nWrite the opening now as JSON.`;
  }

  protected override maxTokens(): number {
    return 900;
  }
}
