import { LockedFeatureError, THIS_PRODUCT, type ReelsRequest, type ReelsResponse } from '@hook/domain';
import type { Clock, GenerationRepository, Logger } from '../../ports';
import type { NonceSource } from '../ai/prompt-builder';
import type { EntitlementResolver } from '../billing/entitlement-resolver';
import { DAY_MS } from '../time';
import type { ContentPolicy } from './content-policy';
import { assertLanguage, type GenerationPipeline } from './generation-pipeline';
import { RETENTION_DAYS, titleOf } from './hook-generation-service';
import { NumberProvenanceCheck } from './number-provenance';
import { ReelsScriptPrompt } from './prompts/reels-script-prompt';
import { ReelsScriptValidator } from './validators/reels-script-validator';

/** US-8. Needs the `reels` unlock; uses 1 `generate` (ADR-0003 D8). */
export class ReelsScriptService {
  readonly #resolver: EntitlementResolver;
  readonly #pipeline: GenerationPipeline;
  readonly #policy: ContentPolicy;
  readonly #generations: GenerationRepository;
  readonly #prompt: ReelsScriptPrompt;
  readonly #clock: Clock;
  readonly #logger: Logger;

  public constructor(deps: {
    resolver: EntitlementResolver;
    pipeline: GenerationPipeline;
    policy: ContentPolicy;
    generations: GenerationRepository;
    nonce: NonceSource;
    clock: Clock;
    logger: Logger;
  }) {
    this.#resolver = deps.resolver;
    this.#pipeline = deps.pipeline;
    this.#policy = deps.policy;
    this.#generations = deps.generations;
    this.#prompt = new ReelsScriptPrompt(deps.nonce);
    this.#clock = deps.clock;
    this.#logger = deps.logger;
  }

  public async create(userId: string, req: ReelsRequest): Promise<ReelsResponse> {
    const access = await this.#resolver.access(userId, THIS_PRODUCT);
    if (!access.profile.has('reels')) throw new LockedFeatureError();
    assertLanguage(req.language, access);
    const input = `${req.topic}\n${String(req.durationSec)}`;
    const ctx = { language: req.language, policy: this.#policy, provenance: new NumberProvenanceCheck(input, req.language) };
    const result = await this.#pipeline.run({
      userId,
      product: THIS_PRODUCT,
      feature: 'generate',
      rateKey: 'reels',
      access,
      inputText: req.topic,
      botToken: null,
      ip: null,
      request: this.#prompt.build(req),
      validate: (raw) => new ReelsScriptValidator(req.durationSec, ctx).validate(raw),
    });
    const now = this.#clock.now();
    await this.#generations
      .save({ userId, product: THIS_PRODUCT, feature: 'reels', title: titleOf(req.topic), output: result, expiresAt: new Date(now.getTime() + RETENTION_DAYS * DAY_MS) })
      .catch(() => this.#logger.warn('history_save_failed', { feature: 'reels' }));
    return result;
  }
}
