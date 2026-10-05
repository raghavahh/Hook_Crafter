/** Razorpay Orders + Checkout (one-time payments). */
export interface PaymentGateway {
  readonly keyId: string;
  createOrder(input: { amountPaise: number; receipt: string; notes: Readonly<Record<string, string>> }): Promise<{ orderId: string }>;
  fetchPayment(paymentId: string): Promise<ProviderPayment>;
  /** Constant-time HMAC check of the Checkout signature. */
  verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): Promise<boolean>;
  /** Constant-time HMAC check over the RAW webhook body. */
  verifyWebhookSignature(rawBody: string, signature: string): Promise<boolean>;
}

export interface ProviderPayment {
  readonly id: string;
  readonly orderId: string | null;
  readonly status: string;
  readonly amountPaise: number;
  readonly currency: string;
}

/** Razorpay Subscriptions. */
export interface SubscriptionGateway {
  readonly keyId: string;
  createSubscription(input: { providerPlanId: string; totalCount: number; notes: Readonly<Record<string, string>> }): Promise<{ subscriptionId: string }>;
  fetchSubscription(subscriptionId: string): Promise<ProviderSubscription>;
  verifySubscriptionSignature(subscriptionId: string, paymentId: string, signature: string): Promise<boolean>;
  cancelAtCycleEnd(subscriptionId: string): Promise<void>;
  cancelNow(subscriptionId: string): Promise<void>;
  changePlanAtCycleEnd(subscriptionId: string, providerPlanId: string): Promise<void>;
}

export interface ProviderSubscription {
  readonly id: string;
  /** Raw provider status (created, authenticated, active, pending, halted, cancelled, completed, expired, paused). */
  readonly status: string;
  readonly providerPlanId: string;
  readonly currentStart: Date | null;
  readonly currentEnd: Date | null;
  readonly paidCount: number;
}
