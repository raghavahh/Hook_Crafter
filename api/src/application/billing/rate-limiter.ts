import { RateLimitError, type ProductId } from '@hook/domain';
import type { Clock, QuotaRepository } from '../../ports';
import { hourKey } from '../time';

/** Per-user hourly limits stored in Postgres (ADR-0003 D13). Limit comes from the user's plan. */
export class RateLimiter {
  readonly #quotas: QuotaRepository;
  readonly #clock: Clock;

  public constructor(quotas: QuotaRepository, clock: Clock) {
    this.#quotas = quotas;
    this.#clock = clock;
  }

  public async hit(userId: string, product: ProductId, routeKey: string, limitPerHour: number): Promise<void> {
    const allowed = await this.#quotas.increment(
      `u:${userId}`,
      product,
      `rate:${routeKey}`,
      hourKey(this.#clock.now()),
      limitPerHour,
    );
    if (!allowed) throw new RateLimitError();
  }
}
