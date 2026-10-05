import type { Logger, PaymentRepository, SubscriptionRepository } from '../../../ports';
import type { PaymentVerificationService } from '../payment-verification-service';
import type { WebhookEnvelope, WebhookHandler } from './webhook-types';

/** Backup path for one-time payments: the same idempotent fulfilment as /v1/pay/verify. */
export class PaymentCapturedHandler implements WebhookHandler {
  public readonly events = ['payment.captured', 'order.paid'] as const;
  readonly #payments: PaymentRepository;
  readonly #verification: PaymentVerificationService;

  public constructor(payments: PaymentRepository, verification: PaymentVerificationService) {
    this.#payments = payments;
    this.#verification = verification;
  }

  public async handle(envelope: WebhookEnvelope): Promise<string> {
    const entity = envelope.payload.payment?.entity;
    const orderId = entity?.order_id;
    if (entity === undefined || orderId === undefined || orderId === null) return 'ignored_no_order';
    const payment = await this.#payments.findByOrderId(orderId);
    if (payment === null) return 'ignored_unknown_order';
    await this.#verification.fulfil(payment, entity.id);
    return 'fulfilled';
  }
}

export class PaymentFailedHandler implements WebhookHandler {
  public readonly events = ['payment.failed'] as const;
  readonly #logger: Logger;

  public constructor(logger: Logger) {
    this.#logger = logger;
  }

  public handle(): Promise<string> {
    this.#logger.info('payment_failed_event');
    return Promise.resolve('logged');
  }
}

/** Refunds revoke what is left: pack/upgrade credits, or a refunded subscription period (S-SUB-13). */
export class RefundProcessedHandler implements WebhookHandler {
  public readonly events = ['refund.processed'] as const;
  readonly #payments: PaymentRepository;
  readonly #subscriptions: SubscriptionRepository;
  readonly #logger: Logger;

  public constructor(payments: PaymentRepository, subscriptions: SubscriptionRepository, logger: Logger) {
    this.#payments = payments;
    this.#subscriptions = subscriptions;
    this.#logger = logger;
  }

  public async handle(envelope: WebhookEnvelope): Promise<string> {
    const refund = envelope.payload.refund?.entity;
    if (refund === undefined) return 'ignored_no_refund';
    if ((await this.#payments.findByPaymentId(refund.payment_id)) !== null) {
      await this.#payments.revokeOnRefund(refund.payment_id, refund.id);
      return 'revoked_payment';
    }
    const period = await this.#subscriptions.findPeriodByPaymentId(refund.payment_id);
    if (period !== null) {
      await this.#subscriptions.revokePeriod(period.subscriptionId, period.periodStart);
      return 'revoked_period';
    }
    this.#logger.warn('refund_unmatched');
    return 'unmatched';
  }
}
