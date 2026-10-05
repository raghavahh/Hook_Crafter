import type { AuditLog, Clock, Logger, SubscriptionGateway, SubscriptionRepository } from '../../ports';
import type { SubscriptionStateResolver } from './subscription-state-resolver';

/** Daily cron (Flow 5 step 6, S-SUB-17): fixes drift from missed webhooks, audit-logged. */
export class BillingReconciler {
  readonly #subscriptions: SubscriptionRepository;
  readonly #gateway: SubscriptionGateway;
  readonly #resolver: SubscriptionStateResolver;
  readonly #audit: AuditLog;
  readonly #clock: Clock;
  readonly #logger: Logger;

  public constructor(deps: {
    subscriptions: SubscriptionRepository;
    gateway: SubscriptionGateway;
    resolver: SubscriptionStateResolver;
    audit: AuditLog;
    clock: Clock;
    logger: Logger;
  }) {
    this.#subscriptions = deps.subscriptions;
    this.#gateway = deps.gateway;
    this.#resolver = deps.resolver;
    this.#audit = deps.audit;
    this.#clock = deps.clock;
    this.#logger = deps.logger;
  }

  public async run(): Promise<{ checked: number; changed: number; failed: number }> {
    let checked = 0;
    let changed = 0;
    let failed = 0;
    for (const record of await this.#subscriptions.listNonEnded()) {
      checked += 1;
      try {
        const provider = await this.#gateway.fetchSubscription(record.providerSubscriptionId);
        const updated = await this.#resolver.sync(record, provider, this.#clock.now(), null);
        const periodMoved = updated.currentPeriodEnd?.getTime() !== record.currentPeriodEnd?.getTime();
        if (updated.status !== record.status || periodMoved) {
          changed += 1;
          await this.#audit.record({ actor: 'reconciler', action: 'subscription_fixed', ref: record.id, details: { from: record.status, to: updated.status } });
        }
      } catch {
        failed += 1;
        this.#logger.error('reconcile_failed', { subscription: record.id });
      }
    }
    this.#logger.info('reconcile_done', { checked, changed, failed });
    return { checked, changed, failed };
  }
}
