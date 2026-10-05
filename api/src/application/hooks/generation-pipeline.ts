import {
  ContentBlockedError,
  isLanguageAllowed,
  LANGUAGE_INFO,
  LockedFeatureError,
  SoldOutError,
  UpstreamError,
  ValidationError,
  type AppError,
  type FeatureKey,
  type Language,
  type ProductId,
} from '@hook/domain';
import type { BotVerifier, LlmRequest, Logger } from '../../ports';
import type { AccessState, EntitlementResolver } from '../billing/entitlement-resolver';
import type { RateLimiter } from '../billing/rate-limiter';
import type { LlmRouter } from '../ai/llm-router';
import type { ContentPolicy } from './content-policy';

export interface PipelineRun<T> {
  readonly userId: string;
  readonly product: ProductId;
  readonly feature: FeatureKey;
  readonly access: AccessState;
  /** All user-supplied text, checked by ContentPolicy BEFORE any credit is reserved. */
  readonly inputText: string;
  /** Turnstile token; only lets the request fall back to the free daily quota. */
  readonly botToken: string | null;
  readonly ip: string | null;
  readonly request: LlmRequest;
  readonly validate: (raw: string) => T;
}

/** reserve -> run -> commit, or release on failure (PRD A6.6). Shared by every AI feature. */
export class GenerationPipeline {
  readonly #resolver: EntitlementResolver;
  readonly #rateLimiter: RateLimiter;
  readonly #policy: ContentPolicy;
  readonly #router: LlmRouter;
  readonly #bot: BotVerifier;
  readonly #logger: Logger;

  public constructor(deps: {
    resolver: EntitlementResolver;
    rateLimiter: RateLimiter;
    policy: ContentPolicy;
    router: LlmRouter;
    bot: BotVerifier;
    logger: Logger;
  }) {
    this.#resolver = deps.resolver;
    this.#rateLimiter = deps.rateLimiter;
    this.#policy = deps.policy;
    this.#router = deps.router;
    this.#bot = deps.bot;
    this.#logger = deps.logger;
  }

  public async run<T>(run: PipelineRun<T>): Promise<T> {
    await this.#rateLimiter.hit(run.userId, run.product, 'ai', run.access.profile.rateLimitPerHour);
    const verdict = await this.#policy.checkInput(run.inputText);
    if (!verdict.allowed) {
      this.#logger.info('content_blocked', { feature: run.feature, category: verdict.category });
      throw new ContentBlockedError();
    }
    const allowFree = run.botToken !== null && (await this.#bot.verify(run.botToken, run.ip));
    const grant = await this.#resolver.reserve(run.userId, run.product, run.feature, allowFree);
    const tier = grant.paid ? run.access.profile.aiTier : 'free';
    try {
      const value = await this.#router.complete(run.request, tier === 'free' && grant.paid ? 'paid' : tier, run.validate);
      await this.#resolver.commit(grant);
      return value;
    } catch (error: unknown) {
      await this.#resolver.release(grant, run.product);
      throw this.#publicError(error);
    }
  }

  #publicError(error: unknown): AppError {
    if (error instanceof SoldOutError) return error;
    this.#logger.error('generation_failed', { name: error instanceof Error ? error.name : 'unknown' });
    return new UpstreamError();
  }
}

/** Language gate (PRD A6.8): disabled languages are invalid, locked ones need an unlock. */
export function assertLanguage(language: Language, access: AccessState): void {
  if (!LANGUAGE_INFO[language].enabled) throw new ValidationError('This language is not available yet.');
  if (!isLanguageAllowed(language, access.profile.unlocks)) throw new LockedFeatureError();
}
