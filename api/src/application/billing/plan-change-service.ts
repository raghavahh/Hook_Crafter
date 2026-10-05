import {
  BillingPastDueError,
  COUNTED_FEATURES,
  NotFoundError,
  PaymentError,
  ValidationError,
  type Catalog,
  type ChangePlanResponse,
  type Credits,
  type FeatureKey,
  type Plan,
  type ProductId,
} from '@hook/domain';
import type { Logger, PaymentGateway, PaymentRecord, PaymentRepository, SubscriptionGateway, SubscriptionRepository } from '../../ports';
import type { ProviderEnv } from './billing-cycle-service';

/** Flow 6. Downgrade at cycle end; upgrade now for the price difference (no proration). */
export class PlanChangeService {
  readonly #catalog: Catalog;
  readonly #subscriptions: SubscriptionRepository;
  readonly #payments: PaymentRepository;
  readonly #paymentGateway: PaymentGateway;
  readonly #subscriptionGateway: SubscriptionGateway;
  readonly #env: ProviderEnv;
  readonly #logger: Logger;

  public constructor(deps: {
    catalog: Catalog;
    subscriptions: SubscriptionRepository;
    payments: PaymentRepository;
    paymentGateway: PaymentGateway;
    subscriptionGateway: SubscriptionGateway;
    env: ProviderEnv;
    logger: Logger;
  }) {
    this.#catalog = deps.catalog;
    this.#subscriptions = deps.subscriptions;
    this.#payments = deps.payments;
    this.#paymentGateway = deps.paymentGateway;
    this.#subscriptionGateway = deps.subscriptionGateway;
    this.#env = deps.env;
    this.#logger = deps.logger;
  }

  public async change(userId: string, product: ProductId, planId: string): Promise<ChangePlanResponse> {
    const record = await this.#subscriptions.findCurrent(userId, product);
    if (record === null) throw new NotFoundError('No active plan.');
    if (record.status === 'past_due') throw new BillingPastDueError();
    if (record.status !== 'active' || record.cancelAtPeriodEnd || record.currentPeriodEnd === null) {
      throw new ValidationError('This plan cannot be changed right now.');
    }
    const current = this.#plan(product, record.planId);
    const target = this.#plan(product, planId);
    if (target.id === current.id) throw new ValidationError('You are already on this plan.');
    if (target.rank < current.rank) {
      await this.#subscriptionGateway.changePlanAtCycleEnd(record.providerSubscriptionId, this.#providerId(target));
      await this.#subscriptions.setPendingPlan(record.id, target.id);
      return { kind: 'downgrade', effectiveAt: record.currentPeriodEnd.toISOString() };
    }
    const amount = target.price.minus(current.price).paise;
    const { orderId } = await this.#paymentGateway.createOrder({
      amountPaise: amount,
      receipt: crypto.randomUUID().replace(/-/gu, '').slice(0, 32),
      notes: { product, purpose: 'upgrade', item: target.id },
    });
    await this.#payments.create({ userId, orderId, product, purpose: 'upgrade', itemId: target.id, amountPaise: amount });
    await this.#subscriptions.setPendingPlan(record.id, null);
    return { kind: 'upgrade', orderId, amount, currency: 'INR', keyId: this.#paymentGateway.keyId };
  }

  /** Called after a verified upgrade payment. Idempotent on the payment id (S-SUB-10). */
  public async applyUpgrade(payment: PaymentRecord, paymentId: string): Promise<void> {
    const record = await this.#subscriptions.findCurrent(payment.userId, payment.product);
    if (record === null || record.currentPeriodStart === null || record.currentPeriodEnd === null) {
      throw new PaymentError('No active plan to upgrade. Contact support for a refund.');
    }
    const current = this.#plan(payment.product, record.planId);
    const target = this.#plan(payment.product, payment.itemId);
    const { granted } = await this.#payments.applyUpgrade({
      orderId: payment.orderId,
      paymentId,
      subscriptionId: record.id,
      newPlanId: target.id,
      topUp: topUpBetween(current, target),
      unlocks: target.unlocks,
      periodStart: record.currentPeriodStart,
      periodEnd: record.currentPeriodEnd,
    });
    if (!granted) return;
    await this.#subscriptionGateway
      .changePlanAtCycleEnd(record.providerSubscriptionId, this.#providerId(target))
      .catch(() => this.#logger.error('upgrade_provider_plan_change_failed', { subscription: record.id }));
  }

  #plan(product: ProductId, planId: string): Plan {
    const plan = this.#catalog.plan(product, planId);
    if (plan === undefined) throw new ValidationError('Unknown plan.');
    return plan;
  }

  #providerId(plan: Plan): string {
    const id = plan.providerPlanIds[this.#env];
    if (id === null) throw new ValidationError('This plan is not available yet.');
    return id;
  }
}

/** Allowance difference for the current period, per feature (never negative). */
export function topUpBetween(current: Plan, target: Plan): Credits {
  const out: Partial<Record<FeatureKey, number>> = {};
  for (const feature of COUNTED_FEATURES) {
    const amount = target.allowances[feature];
    if (amount !== undefined) out[feature] = Math.max(0, amount - (current.allowances[feature] ?? 0));
  }
  return out;
}
