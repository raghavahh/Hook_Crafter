import { z } from 'zod';
import { codePointLength, FRAMEWORKS, rulesFor, type GeneratePlatform, type RewritePostResponse } from '@hook/domain';
import { OutputValidator } from '../../ai/output-validator';
import { cleanText, textProblem, type TextCheckContext } from './text-checks';

const ModelOutput = z.object({ post: z.string(), hookFrameworkId: z.string() });

export class PostRewriteValidator extends OutputValidator<RewritePostResponse> {
  readonly #platform: GeneratePlatform;
  readonly #ctx: TextCheckContext;

  public constructor(platform: GeneratePlatform, ctx: TextCheckContext) {
    super();
    this.#platform = platform;
    this.#ctx = ctx;
  }

  protected override parse(json: unknown): RewritePostResponse {
    const result = ModelOutput.safeParse(json);
    if (!result.success) return this.fail('schema');
    return { post: cleanText(result.data.post), hookFrameworkId: result.data.hookFrameworkId.trim() };
  }

  protected override check(value: RewritePostResponse): void {
    const length = codePointLength(value.post);
    if (length === 0 || length > 5000) this.fail('length');
    const firstLine = value.post.split('\n')[0] ?? '';
    if (codePointLength(firstLine) > rulesFor(this.#platform).hookMaxLength) this.fail('opening_length');
    if (!FRAMEWORKS.has(value.hookFrameworkId)) this.fail('framework');
    const problem = textProblem(value.post, this.#ctx);
    if (problem !== null) this.fail(problem);
  }
}
