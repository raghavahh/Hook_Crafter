import { THIS_PRODUCT, type RewritePostRequest, type RewritePostResponse } from '@hook/domain';
import type { NonceSource } from '../ai/prompt-builder';
import type { EntitlementResolver } from '../billing/entitlement-resolver';
import type { ContentPolicy } from './content-policy';
import { assertLanguage, type GenerationPipeline } from './generation-pipeline';
import { NumberProvenanceCheck } from './number-provenance';
import { PostRewritePrompt } from './prompts/post-rewrite-prompt';
import { PostRewriteValidator } from './validators/post-rewrite-validator';

/** US-7. Uses 1 `post_rewrite`. Output is NOT stored: full posts carry personal data (ADR-0003 D5). */
export class PostRewriteService {
  readonly #resolver: EntitlementResolver;
  readonly #pipeline: GenerationPipeline;
  readonly #policy: ContentPolicy;
  readonly #prompt: PostRewritePrompt;

  public constructor(deps: { resolver: EntitlementResolver; pipeline: GenerationPipeline; policy: ContentPolicy; nonce: NonceSource }) {
    this.#resolver = deps.resolver;
    this.#pipeline = deps.pipeline;
    this.#policy = deps.policy;
    this.#prompt = new PostRewritePrompt(deps.nonce);
  }

  public async rewrite(userId: string, req: RewritePostRequest): Promise<RewritePostResponse> {
    const access = await this.#resolver.access(userId, THIS_PRODUCT);
    assertLanguage(req.language, access);
    const ctx = { language: req.language, policy: this.#policy, provenance: new NumberProvenanceCheck(req.post, req.language) };
    return this.#pipeline.run({
      userId,
      product: THIS_PRODUCT,
      feature: 'post_rewrite',
      rateKey: 'rewrite_post',
      access,
      inputText: req.post,
      botToken: null,
      ip: null,
      request: this.#prompt.build(req),
      validate: (raw) => new PostRewriteValidator(req.platform, ctx).validate(raw),
    });
  }
}
