import { ValidationError, type CreateOrderRequest, type OrderResponse } from '@hook/domain';
import type { Catalog } from '@hook/domain';
import type { PaymentGateway, PaymentRepository } from '../../ports';

/** Flow 4 step 1: the server prices from Catalog (T4 / S-05). The browser sends only packId. */
export class CheckoutService {
  readonly #catalog: Catalog;
  readonly #gateway: PaymentGateway;
  readonly #payments: PaymentRepository;

  public constructor(deps: { catalog: Catalog; gateway: PaymentGateway; payments: PaymentRepository }) {
    this.#catalog = deps.catalog;
    this.#gateway = deps.gateway;
    this.#payments = deps.payments;
  }

  public async createOrder(userId: string, req: CreateOrderRequest): Promise<OrderResponse> {
    const pack = this.#catalog.pack(req.product, req.packId);
    if (pack === undefined) throw new ValidationError('Unknown pack.');
    const { orderId } = await this.#gateway.createOrder({
      amountPaise: pack.price.paise,
      receipt: crypto.randomUUID().replace(/-/gu, '').slice(0, 32),
      notes: { product: req.product, purpose: 'pack', item: pack.id },
    });
    await this.#payments.create({
      userId,
      orderId,
      product: req.product,
      purpose: 'pack',
      itemId: pack.id,
      amountPaise: pack.price.paise,
    });
    return { orderId, amount: pack.price.paise, currency: 'INR', keyId: this.#gateway.keyId };
  }
}
