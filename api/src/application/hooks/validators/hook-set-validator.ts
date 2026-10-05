import { z } from 'zod';
import { codePointLength, FRAMEWORKS, rulesFor, type GeneratePlatform, type GenerateResponse } from '@hook/domain';
import { OutputValidator } from '../../ai/output-validator';
import { hasNearDuplicates } from '../similarity';
import { cleanText, textProblem, type TextCheckContext } from './text-checks';

const ModelOutput = z.object({
  hooks: z.array(z.object({ text: z.string(), frameworkId: z.string() })).length(10),
});

/** PRD B4 Flow 2 step 3: exactly 10, lengths, known frameworks, no near-duplicates, script, numbers, policy. */
export class HookSetValidator extends OutputValidator<GenerateResponse> {
  readonly #platform: GeneratePlatform;
  readonly #ctx: TextCheckContext;

  public constructor(platform: GeneratePlatform, ctx: TextCheckContext) {
    super();
    this.#platform = platform;
    this.#ctx = ctx;
  }

  protected override parse(json: unknown): GenerateResponse {
    const result = ModelOutput.safeParse(json);
    if (!result.success) return this.fail('schema');
    return {
      hooks: result.data.hooks.map((h) => ({
        text: cleanText(h.text),
        frameworkId: h.frameworkId.trim(),
        platform: this.#platform,
      })),
    };
  }

  protected override check(value: GenerateResponse): void {
    const max = rulesFor(this.#platform).hookMaxLength;
    for (const hook of value.hooks) {
      const length = codePointLength(hook.text);
      if (length === 0 || length > max) this.fail('length');
      if (!FRAMEWORKS.has(hook.frameworkId)) this.fail('framework');
      const problem = textProblem(hook.text, this.#ctx);
      if (problem !== null) this.fail(problem);
    }
    if (hasNearDuplicates(value.hooks.map((h) => h.text))) this.fail('near_duplicate');
  }
}
