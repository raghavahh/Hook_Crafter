import { codePointLength, LockedFeatureError, THIS_PRODUCT, type GenerateRequest, type GenerateResponse } from '@hook/domain';
import type { Clock, GenerationRepository, Logger } from '../../ports';
import type { NonceSource } from '../ai/prompt-builder';
import type { EntitlementResolver } from '../billing/entitlement-resolver';
import { DAY_MS } from '../time';
import type { ContentPolicy } from './content-policy';
import { assertLanguage, type GenerationPipeline } from './generation-pipeline';
import { NumberProvenanceCheck } from './number-provenance';
import { HookGenerationPrompt } from './prompts/hook-generation-prompt';
import { HookSetValidator } from './validators/hook-set-validator';

export const RETENTION_DAYS = 30;

export function titleOf(text: string): string {
  const firstLine = text.split('\n')[0] ?? '';
  return codePointLength(firstLine) <= 80 ? firstLine : `${Array.from(firstLine).slice(0, 79).join('')}…`;
}

export class HookGenerationService {
  readonly #resolver: EntitlementResolver;
  readonly #pipeline: GenerationPipeline;
  readonly #policy: ContentPolicy;
  readonly #generations: GenerationRepository;
  readonly #prompt: HookGenerationPrompt;
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
    this.#prompt = new HookGenerationPrompt(deps.nonce);
    this.#clock = deps.clock;
    this.#logger = deps.logger;
  }

  public async generate(userId: string, req: GenerateRequest, ip: string | null): Promise<GenerateResponse> {
    const access = await this.#resolver.access(userId, THIS_PRODUCT);
    assertLanguage(req.language, access);
    if (req.voice !== undefined && !access.profile.has('voice_profiles')) throw new LockedFeatureError();
    const userText = [req.topic, req.audience ?? '', ...Object.values(req.voice ?? {})].join('\n');
    const ctx = { language: req.language, policy: this.#policy, provenance: new NumberProvenanceCheck(userText, req.language) };
    const result = await this.#pipeline.run({
      userId,
      product: THIS_PRODUCT,
      feature: 'generate',
      access,
      inputText: userText,
      botToken: req.turnstileToken ?? null,
      ip,
      request: this.#prompt.build(req),
      validate: (raw) => new HookSetValidator(req.platform, ctx).validate(raw),
    });
    await this.#remember(userId, req.topic, result);
    return result;
  }

  /** History is best-effort: a failed save never fails a paid generation. */
  async #remember(userId: string, topic: string, output: GenerateResponse): Promise<void> {
    const now = this.#clock.now();
    try {
      await this.#generations.save({
        userId,
        product: THIS_PRODUCT,
        feature: 'generate',
        title: titleOf(topic),
        output,
        expiresAt: new Date(now.getTime() + RETENTION_DAYS * DAY_MS),
      });
    } catch {
      this.#logger.warn('history_save_failed', { feature: 'generate' });
    }
  }
}
