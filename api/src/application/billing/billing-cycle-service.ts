import type { Catalog } from '@hook/domain';
import type { Logger, ProviderSubscription, SubscriptionRecord, SubscriptionRepository } from '../../ports';

export type ProviderEnv = 'test' | 'live';

/** Each confirmed charge grants exactly one period of allowance + plan unlocks (PRD A6.7 Renewal). */
export class BillingCycleService {
  readonly #subscriptions: SubscriptionRepository;
  readonly #catalog: Catalog;
  readonly #env: ProviderEnv;
  readonly #logger: Logger;

  public constructor(deps: { subscriptions: SubscriptionRepository; catalog: Catalog; env: ProviderEnv; logger: Logger }) {
    this.#subscriptions = deps.subscriptions;
    this.#catalog = deps.catalog;
    this.#env = deps.env;
    this.#logger = deps.logger;
  }

  public async grantForCharge(record: SubscriptionRecord, provider: ProviderSubscription, paymentId: string | null): Promise<void> {
    if (provider.currentStart === null || provider.currentEnd === null) return;
    const plan =
      this.#catalog.planByProviderId(provider.providerPlanId, this.#env) ?? this.#catalog.plan(record.product, record.planId);
    if (plan === undefined) {
      this.#logger.error('subscription_plan_unknown', { subscription: record.id });
      return;
    }
    if (plan.id !== record.planId) await this.#subscriptions.setPlan(record.id, plan.id);
    if (record.pendingPlanId !== null && record.pendingPlanId === plan.id) await this.#subscriptions.setPendingPlan(record.id, null);
    const { granted } = await this.#subscriptions.grantPeriod({
      subscriptionId: record.id,
      planId: plan.id,
      periodStart: provider.currentStart,
      periodEnd: provider.currentEnd,
      allowances: plan.allowances,
      unlocks: plan.unlocks,
      paymentId,
    });
    this.#logger.info('subscription_period', { subscription: record.id, plan: plan.id, granted });
  }
}
