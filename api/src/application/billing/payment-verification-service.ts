import { PaymentError, type Catalog, type VerifyPaymentRequest } from '@hook/domain';
import type { Logger, PaymentGateway, PaymentRecord, PaymentRepository } from '../../ports';
import type { PlanChangeService } from './plan-change-service';

/**
 * Flow 4 step 3 (T3 / S-04..S-06): constant-time signature check, THEN the Razorpay API lookup
 * (captured, order + amount + currency match), THEN an idempotent grant in one DB transaction.
 */
export class PaymentVerificationService {
  readonly #catalog: Catalog;
  readonly #gateway: PaymentGateway;
  readonly #payments: PaymentRepository;
  readonly #planChanges: PlanChangeService;
  readonly #logger: Logger;

  public constructor(deps: { catalog: Catalog; gateway: PaymentGateway; payments: PaymentRepository; planChanges: PlanChangeService; logger: Logger }) {
    this.#catalog = deps.catalog;
    this.#gateway = deps.gateway;
    this.#payments = deps.payments;
    this.#planChanges = deps.planChanges;
    this.#logger = deps.logger;
  }

  public async verify(userId: string, req: VerifyPaymentRequest): Promise<void> {
    const payment = await this.#payments.findByOrderId(req.orderId);
    if (payment?.userId !== userId) throw new PaymentError();
    if (!(await this.#gateway.verifyCheckoutSignature(req.orderId, req.paymentId, req.signature))) throw new PaymentError();
    await this.fulfil(payment, req.paymentId);
  }

  /** Shared by /verify and the webhook backup. Safe to call any number of times. */
  public async fulfil(payment: PaymentRecord, paymentId: string): Promise<void> {
    if (payment.status === 'paid') {
      if (payment.paymentId !== paymentId) throw new PaymentError();
      return;
    }
    if (payment.status !== 'created') throw new PaymentError();
    const provider = await this.#gateway.fetchPayment(paymentId);
    const matches =
      provider.status === 'captured' &&
      provider.orderId === payment.orderId &&
      provider.amountPaise === payment.amountPaise &&
      provider.currency === 'INR';
    if (!matches) {
      this.#logger.warn('payment_mismatch', { order: payment.orderId, status: provider.status });
      throw new PaymentError();
    }
    if (payment.purpose === 'upgrade') {
      await this.#planChanges.applyUpgrade(payment, paymentId);
      return;
    }
    const pack = this.#catalog.pack(payment.product, payment.itemId);
    if (pack === undefined) throw new PaymentError();
    const { granted } = await this.#payments.grantPack({ orderId: payment.orderId, paymentId, credits: pack.credits, unlocks: pack.unlocks });
    this.#logger.info('pack_granted', { order: payment.orderId, granted });
  }
}
