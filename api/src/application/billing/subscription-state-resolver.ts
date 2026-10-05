import type { SubscriptionStatus } from '@hook/domain';
import type { Logger, ProviderSubscription, SubscriptionRecord, SubscriptionRepository } from '../../ports';
import type { BillingCycleService } from './billing-cycle-service';

const STATUS_MAP: Readonly<Record<string, SubscriptionStatus>> = {
  created: 'created',
  authenticated: 'authenticated',
  active: 'active',
  pending: 'past_due',
  halted: 'halted',
  paused: 'paused',
  cancelled: 'cancelled',
  completed: 'completed',
  expired: 'expired',
};

/**
 * Applies provider truth to our record (T-SUB-3). Only allowed transitions, never backwards,
 * ignores events older than last_event_at (enforced in the repository/SQL). A confirmed charge
 * grants that period once (unique per period).
 */
export class SubscriptionStateResolver {
  readonly #subscriptions: SubscriptionRepository;
  readonly #cycles: BillingCycleService;
  readonly #logger: Logger;

  public constructor(deps: { subscriptions: SubscriptionRepository; cycles: BillingCycleService; logger: Logger }) {
    this.#subscriptions = deps.subscriptions;
    this.#cycles = deps.cycles;
    this.#logger = deps.logger;
  }

  public static mapStatus(providerStatus: string): SubscriptionStatus | null {
    return STATUS_MAP[providerStatus] ?? null;
  }

  public async sync(record: SubscriptionRecord, provider: ProviderSubscription, eventAt: Date, paymentId: string | null): Promise<SubscriptionRecord> {
    const status = SubscriptionStateResolver.mapStatus(provider.status);
    if (status === null) {
      this.#logger.warn('subscription_unknown_status', { subscription: record.id });
      return record;
    }
    const result = await this.#subscriptions.applyEvent({
      providerSubscriptionId: record.providerSubscriptionId,
      status,
      eventAt,
      periodStart: provider.currentStart,
      periodEnd: provider.currentEnd,
    });
    const current = result.record ?? record;
    if (status === 'active' && provider.paidCount > 0) await this.#cycles.grantForCharge(current, provider, paymentId);
    this.#logger.info('subscription_synced', { subscription: record.id, status, applied: result.applied });
    return current;
  }
}
