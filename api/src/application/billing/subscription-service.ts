import {
  NotFoundError,
  PaymentError,
  SubscriptionExistsError,
  UnavailableError,
  ValidationError,
  type Catalog,
  type ProductId,
  type SubscriptionStatus,
} from '@hook/domain';
import type { Clock, Logger, SubscriptionGateway, SubscriptionRecord, SubscriptionRepository } from '../../ports';
import type { ProviderEnv } from './billing-cycle-service';
import type { SubscriptionStateResolver } from './subscription-state-resolver';

/** Flow 5. Status is only ever decided from verified provider data (T-SUB-1). */
export class SubscriptionService {
  readonly #catalog: Catalog;
  readonly #gateway: SubscriptionGateway;
  readonly #subscriptions: SubscriptionRepository;
  readonly #resolver: SubscriptionStateResolver;
  readonly #env: ProviderEnv;
  readonly #clock: Clock;
  readonly #logger: Logger;

  public constructor(deps: {
    catalog: Catalog;
    gateway: SubscriptionGateway;
    subscriptions: SubscriptionRepository;
    resolver: SubscriptionStateResolver;
    env: ProviderEnv;
    clock: Clock;
    logger: Logger;
  }) {
    this.#catalog = deps.catalog;
    this.#gateway = deps.gateway;
    this.#subscriptions = deps.subscriptions;
    this.#resolver = deps.resolver;
    this.#env = deps.env;
    this.#clock = deps.clock;
    this.#logger = deps.logger;
  }

  public async create(userId: string, product: ProductId, planId: string): Promise<{ subscriptionId: string; keyId: string }> {
    const plan = this.#catalog.plan(product, planId);
    if (plan === undefined) throw new ValidationError('Unknown plan.');
    const providerPlanId = plan.providerPlanIds[this.#env];
    if (providerPlanId === null) throw new UnavailableError('Monthly plans are not available yet.');
    if ((await this.#subscriptions.findCurrent(userId, product)) !== null) throw new SubscriptionExistsError();
    const { subscriptionId } = await this.#gateway.createSubscription({
      providerPlanId,
      totalCount: 120,
      notes: { product, plan: plan.id },
    });
    try {
      await this.#subscriptions.create({ userId, product, planId: plan.id, providerSubscriptionId: subscriptionId });
    } catch (error: unknown) {
      if (error instanceof SubscriptionExistsError) await this.#gateway.cancelNow(subscriptionId).catch(() => undefined);
      throw error;
    }
    return { subscriptionId, keyId: this.#gateway.keyId };
  }

  public async verify(userId: string, subscriptionId: string, paymentId: string, signature: string): Promise<{ status: SubscriptionStatus }> {
    const record = await this.#owned(userId, subscriptionId);
    if (!(await this.#gateway.verifySubscriptionSignature(subscriptionId, paymentId, signature))) throw new PaymentError();
    const provider = await this.#gateway.fetchSubscription(subscriptionId);
    const updated = await this.#resolver.sync(record, provider, this.#clock.now(), paymentId);
    return { status: updated.status };
  }

  /** One click, effective at period end (US-16). */
  public async cancel(userId: string, product: ProductId): Promise<{ accessUntil: string }> {
    const record = await this.#subscriptions.findCurrent(userId, product);
    if (record === null) throw new NotFoundError('No active plan.');
    if (!record.cancelAtPeriodEnd) {
      await this.#gateway.cancelAtCycleEnd(record.providerSubscriptionId);
      await this.#subscriptions.setCancelAtPeriodEnd(record.id, true);
      this.#logger.info('subscription_cancel_requested', { subscription: record.id });
    }
    return { accessUntil: (record.currentPeriodEnd ?? this.#clock.now()).toISOString() };
  }

  /** Account deletion: stop every future charge immediately (US-12). */
  public async cancelAllNow(userId: string): Promise<void> {
    for (const record of await this.#subscriptions.listForUser(userId)) {
      if (['cancelled', 'completed', 'expired'].includes(record.status)) continue;
      await this.#gateway.cancelNow(record.providerSubscriptionId);
    }
  }

  async #owned(userId: string, providerSubscriptionId: string): Promise<SubscriptionRecord> {
    const record = await this.#subscriptions.findByProviderId(providerSubscriptionId);
    if (record?.userId !== userId) throw new NotFoundError();
    return record;
  }
}
