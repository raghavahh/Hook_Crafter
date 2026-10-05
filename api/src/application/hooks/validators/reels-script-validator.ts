import { z } from 'zod';
import { ReelsResponseSchema, type ReelsResponse } from '@hook/domain';
import { OutputValidator } from '../../ai/output-validator';
import { cleanText, textProblem, type TextCheckContext } from './text-checks';

const ModelOutput = z.object({
  spokenLine: z.string(),
  onScreenText: z.string(),
  visualIdea: z.string(),
  beats: z.array(z.object({ atSec: z.number(), action: z.string() })),
});

export class ReelsScriptValidator extends OutputValidator<ReelsResponse> {
  readonly #durationSec: number;
  readonly #ctx: TextCheckContext;

  public constructor(durationSec: number, ctx: TextCheckContext) {
    super();
    this.#durationSec = durationSec;
    this.#ctx = ctx;
  }

  protected override parse(json: unknown): ReelsResponse {
    const raw = ModelOutput.safeParse(json);
    if (!raw.success) return this.fail('schema');
    const candidate = {
      spokenLine: cleanText(raw.data.spokenLine),
      onScreenText: cleanText(raw.data.onScreenText),
      visualIdea: cleanText(raw.data.visualIdea),
      beats: raw.data.beats.map((b) => ({ atSec: Math.round(b.atSec), action: cleanText(b.action) })),
    };
    const result = ReelsResponseSchema.safeParse(candidate);
    return result.success ? result.data : this.fail('schema');
  }

  protected override check(value: ReelsResponse): void {
    let previous = -1;
    for (const beat of value.beats) {
      if (beat.atSec < previous || beat.atSec > this.#durationSec) this.fail('beats');
      previous = beat.atSec;
    }
    for (const text of [value.spokenLine, value.onScreenText, value.visualIdea]) {
      const problem = textProblem(text, this.#ctx);
      if (problem !== null) this.fail(problem);
    }
    // Beat timings ("at 3s") are structure, not claims: policy + script only.
    for (const beat of value.beats) {
      const problem = textProblem(beat.action, this.#ctx, false);
      if (problem !== null) this.fail(problem);
    }
  }
}
