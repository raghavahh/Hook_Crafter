import { SoldOutError, UpstreamError, type AiTier } from '@hook/domain';
import { ProviderError, type AiBudgetRepository, type Clock, type LlmProvider, type LlmRequest, type Logger } from '../../ports';
import { dayKey } from '../time';
import { OutputInvalidError } from './output-validator';

export interface TierEntry {
  readonly provider: LlmProvider;
  /** ~80% of the provider's free daily limit (config). */
  readonly dailyCap: number;
}

export type TierConfig = Readonly<Record<AiTier, readonly TierEntry[]>>;

export interface RouterTimeouts {
  readonly perCallMs: number;
  readonly totalMs: number;
}

/**
 * Strategy + chain of responsibility (SHARED-ENGINE section 9). Each tier has its own provider
 * list and budget key, so free traffic can never use paid-tier providers (S-11).
 */
export class LlmRouter {
  readonly #tiers: TierConfig;
  readonly #budget: AiBudgetRepository;
  readonly #clock: Clock;
  readonly #logger: Logger;
  readonly #timeouts: RouterTimeouts;

  public constructor(deps: { tiers: TierConfig; budget: AiBudgetRepository; clock: Clock; logger: Logger; timeouts?: RouterTimeouts }) {
    this.#tiers = deps.tiers;
    this.#budget = deps.budget;
    this.#clock = deps.clock;
    this.#logger = deps.logger;
    this.#timeouts = deps.timeouts ?? { perCallMs: 15_000, totalMs: 25_000 };
  }

  public async complete<T>(request: LlmRequest, tier: AiTier, validate: (raw: string) => T): Promise<T> {
    const deadline = Date.now() + this.#timeouts.totalMs;
    let budgetLeft = false;
    for (const entry of this.#tiers[tier]) {
      if (Date.now() >= deadline) break;
      if (!(await this.#budget.take(dayKey(this.#clock.now()), entry.provider.id, tier, entry.dailyCap))) continue;
      budgetLeft = true;
      const result = await this.#tryProvider(entry.provider, request, validate, deadline, tier);
      if (result.ok) return result.value;
    }
    throw budgetLeft ? new UpstreamError() : new SoldOutError();
  }

  /** One call plus one retry on invalid output, then give up on this provider. */
  async #tryProvider<T>(
    provider: LlmProvider,
    request: LlmRequest,
    validate: (raw: string) => T,
    deadline: number,
    tier: AiTier,
  ): Promise<{ ok: true; value: T } | { ok: false }> {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) return { ok: false };
      const started = Date.now();
      try {
        const raw = await provider.complete(request, AbortSignal.timeout(Math.min(this.#timeouts.perCallMs, remaining)));
        const value = validate(raw);
        this.#logger.info('llm_ok', { provider: provider.id, tier, attempt, latencyMs: Date.now() - started });
        return { ok: true, value };
      } catch (error: unknown) {
        const reason = this.#reason(error);
        this.#logger.warn('llm_fail', { provider: provider.id, tier, attempt, reason, latencyMs: Date.now() - started });
        if (reason !== 'invalid_output') return { ok: false };
      }
    }
    return { ok: false };
  }

  #reason(error: unknown): string {
    if (error instanceof OutputInvalidError) return 'invalid_output';
    if (error instanceof ProviderError) return error.kind;
    if (error instanceof DOMException && error.name === 'TimeoutError') return 'timeout';
    return 'failed';
  }
}
