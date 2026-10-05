import type { Logger, SubscriptionGateway, SubscriptionRepository } from '../../../ports';
import type { SubscriptionStateResolver } from '../subscription-state-resolver';
import type { WebhookEnvelope, WebhookHandler } from './webhook-types';

/**
 * All subscription.* events: the payload only tells us WHICH subscription changed; the state
 * itself is re-fetched from the Razorpay API (source of truth), then applied in order.
 * Event names follow Razorpay's docs; verify them again before going live (PRD Flow 5).
 */
export class SubscriptionEventHandler implements WebhookHandler {
  public readonly events = [
    'subscription.authenticated',
    'subscription.activated',
    'subscription.charged',
    'subscription.pending',
    'subscription.halted',
    'subscription.paused',
    'subscription.resumed',
    'subscription.cancelled',
    'subscription.completed',
    'subscription.updated',
  ] as const;

  readonly #subscriptions: SubscriptionRepository;
  readonly #gateway: SubscriptionGateway;
  readonly #resolver: SubscriptionStateResolver;
  readonly #logger: Logger;

  public constructor(deps: { subscriptions: SubscriptionRepository; gateway: SubscriptionGateway; resolver: SubscriptionStateResolver; logger: Logger }) {
    this.#subscriptions = deps.subscriptions;
    this.#gateway = deps.gateway;
    this.#resolver = deps.resolver;
    this.#logger = deps.logger;
  }

  public async handle(envelope: WebhookEnvelope): Promise<string> {
    const id = envelope.payload.subscription?.entity.id;
    if (id === undefined) return 'ignored_no_subscription';
    const record = await this.#subscriptions.findByProviderId(id);
    if (record === null) {
      this.#logger.warn('subscription_event_unknown');
      return 'ignored_unknown_subscription';
    }
    const provider = await this.#gateway.fetchSubscription(id);
    const paymentId = envelope.event === 'subscription.charged' ? (envelope.payload.payment?.entity.id ?? null) : null;
    const updated = await this.#resolver.sync(record, provider, new Date(envelope.created_at * 1000), paymentId);
    return `status_${updated.status}`;
  }
}
