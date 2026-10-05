import { z } from 'zod';
import type { PaymentGateway, ProviderPayment, ProviderSubscription, SubscriptionGateway } from '../../ports';
import { verifyHmac } from './hmac';

const API = 'https://api.razorpay.com/v1';

const OrderSchema = z.object({ id: z.string() });
const PaymentSchema = z.object({
  id: z.string(),
  order_id: z.string().nullable().optional(),
  status: z.string(),
  amount: z.number().int(),
  currency: z.string(),
});
const SubscriptionSchema = z.object({
  id: z.string(),
  status: z.string(),
  plan_id: z.string(),
  current_start: z.number().int().nullable().optional(),
  current_end: z.number().int().nullable().optional(),
  paid_count: z.number().int().optional(),
});

const toDate = (seconds: number | null | undefined): Date | null =>
  seconds === null || seconds === undefined ? null : new Date(seconds * 1000);

export interface RazorpayOptions {
  readonly keyId: string;
  readonly keySecret: string;
  readonly webhookSecret: string;
  readonly fetchImpl?: typeof fetch;
}

/** Razorpay Orders + Checkout + Subscriptions (PaymentGateway + SubscriptionGateway). */
export class RazorpayGateway implements PaymentGateway, SubscriptionGateway {
  public readonly keyId: string;
  readonly #keySecret: string;
  readonly #webhookSecret: string;
  readonly #fetch: typeof fetch;

  public constructor(options: RazorpayOptions) {
    this.keyId = options.keyId;
    this.#keySecret = options.keySecret;
    this.#webhookSecret = options.webhookSecret;
    this.#fetch = options.fetchImpl ?? fetch;
  }

  public async createOrder(input: { amountPaise: number; receipt: string; notes: Readonly<Record<string, string>> }): Promise<{ orderId: string }> {
    const body = { amount: input.amountPaise, currency: 'INR', receipt: input.receipt, notes: input.notes };
    const order = OrderSchema.parse(await this.#call('POST', '/orders', body));
    return { orderId: order.id };
  }

  public async fetchPayment(paymentId: string): Promise<ProviderPayment> {
    const p = PaymentSchema.parse(await this.#call('GET', `/payments/${encodeURIComponent(paymentId)}`));
    return { id: p.id, orderId: p.order_id ?? null, status: p.status, amountPaise: p.amount, currency: p.currency };
  }

  public verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): Promise<boolean> {
    return verifyHmac(this.#keySecret, `${orderId}|${paymentId}`, signature);
  }

  public verifyWebhookSignature(rawBody: string, signature: string): Promise<boolean> {
    return verifyHmac(this.#webhookSecret, rawBody, signature);
  }

  public async createSubscription(input: { providerPlanId: string; totalCount: number; notes: Readonly<Record<string, string>> }): Promise<{ subscriptionId: string }> {
    const body = { plan_id: input.providerPlanId, total_count: input.totalCount, customer_notify: 1, notes: input.notes };
    const sub = SubscriptionSchema.parse(await this.#call('POST', '/subscriptions', body));
    return { subscriptionId: sub.id };
  }

  public async fetchSubscription(subscriptionId: string): Promise<ProviderSubscription> {
    const s = SubscriptionSchema.parse(await this.#call('GET', `/subscriptions/${encodeURIComponent(subscriptionId)}`));
    return {
      id: s.id,
      status: s.status,
      providerPlanId: s.plan_id,
      currentStart: toDate(s.current_start),
      currentEnd: toDate(s.current_end),
      paidCount: s.paid_count ?? 0,
    };
  }

  /** Razorpay Subscriptions checkout signature: HMAC(payment_id + "|" + subscription_id). Re-check against current docs. */
  public verifySubscriptionSignature(subscriptionId: string, paymentId: string, signature: string): Promise<boolean> {
    return verifyHmac(this.#keySecret, `${paymentId}|${subscriptionId}`, signature);
  }

  public async cancelAtCycleEnd(subscriptionId: string): Promise<void> {
    await this.#call('POST', `/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, { cancel_at_cycle_end: 1 });
  }

  public async cancelNow(subscriptionId: string): Promise<void> {
    await this.#call('POST', `/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, { cancel_at_cycle_end: 0 });
  }

  public async changePlanAtCycleEnd(subscriptionId: string, providerPlanId: string): Promise<void> {
    await this.#call('PATCH', `/subscriptions/${encodeURIComponent(subscriptionId)}`, { plan_id: providerPlanId, schedule_change_at: 'cycle_end' });
  }

  async #call(method: string, path: string, body?: unknown): Promise<unknown> {
    const init: RequestInit = {
      method,
      headers: { authorization: `Basic ${btoa(`${this.keyId}:${this.#keySecret}`)}`, 'content-type': 'application/json' },
      signal: AbortSignal.timeout(10_000),
    };
    if (body !== undefined) init.body = JSON.stringify(body);
    const response = await this.#fetch(`${API}${path}`, init);
    if (!response.ok) throw new Error(`razorpay ${method} ${path.split('/')[1] ?? ''} failed: ${String(response.status)}`);
    return (await response.json()) as unknown;
  }
}
