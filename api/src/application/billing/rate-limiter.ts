import { RateLimitError, type ProductId } from '@hook/domain';
import type { Clock, QuotaRepository } from '../../ports';
import { dayKey, hourKey } from '../time';

export type RateWindow = 'hour' | 'day';

/** Per-user limits stored in Postgres (ADR-0003 D13). Limits come from PRD B5 / the user's plan. */
export class RateLimiter {
  readonly #quotas: QuotaRepository;
  readonly #clock: Clock;

  public constructor(quotas: QuotaRepository, clock: Clock) {
    this.#quotas = quotas;
    this.#clock = clock;
  }

  public async hit(userId: string, product: ProductId, routeKey: string, limit: number, window: RateWindow = 'hour'): Promise<void> {
    const now = this.#clock.now();
    const bucket = window === 'hour' ? hourKey(now) : dayKey(now);
    const allowed = await this.#quotas.increment(`u:${userId}`, product, `rate:${routeKey}`, bucket, limit);
    if (!allowed) throw new RateLimitError();
  }
}
