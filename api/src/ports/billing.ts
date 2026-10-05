import type { Credits, FeatureKey, ProductId, SubscriptionStatus, UnlockKey } from '@hook/domain';

export type CreditSourceKind = 'monthly_allowance' | 'one_time_credit';

export interface Reservation {
  readonly id: string;
  readonly kind: CreditSourceKind;
}

export interface EntitlementSummary {
  readonly credits: Readonly<Record<FeatureKey, number>>;
  readonly unlocks: readonly UnlockKey[];
  /** Plan with a current, non-revoked period at `now`. */
  readonly activePlanId: string | null;
  readonly hasPaidPack: boolean;
}

/**
 * Credits + unlocks. reserve() applies the A6.6 priority atomically:
 * monthly_allowance (earliest period_end) -> one_time_credit (oldest). null = nothing left.
 */
export interface EntitlementRepository {
  reserve(userId: string, product: ProductId, feature: FeatureKey, now: Date): Promise<Reservation | null>;
  commit(reservationId: string): Promise<void>;
  /** Returns the credit to the SAME row it came from. Idempotent. */
  release(reservationId: string): Promise<void>;
  summary(userId: string, product: ProductId, now: Date): Promise<EntitlementSummary>;
}

/** Daily free quota and hourly rate-limit counters, keyed by an opaque subject + bucket. */
export interface QuotaRepository {
  /** Atomically increments if below `limit`; returns false (no change) when the limit is reached. */
  increment(subject: string, product: ProductId, feature: string, bucket: string, limit: number): Promise<boolean>;
  /** Undo one increment (never below 0). */
  decrement(subject: string, product: ProductId, feature: string, bucket: string): Promise<void>;
  get(subject: string, product: ProductId, feature: string, bucket: string): Promise<number>;
}

export interface AiBudgetRepository {
  /** Atomically counts one call for (day, provider, tier) if below `cap`. */
  take(day: string, provider: string, tier: string, cap: number): Promise<boolean>;
}

export type PaymentPurpose = 'pack' | 'upgrade';
export type PaymentStatus = 'created' | 'paid' | 'failed' | 'refunded';

export interface NewPayment {
  readonly userId: string;
  readonly orderId: string;
  readonly product: ProductId;
  readonly purpose: PaymentPurpose;
  /** Pack id, or the target plan id for upgrades. */
  readonly itemId: string;
  readonly amountPaise: number;
}

export interface PaymentRecord extends NewPayment {
  readonly status: PaymentStatus;
  readonly paymentId: string | null;
}

export interface GrantPackInput {
  readonly orderId: string;
  readonly paymentId: string;
  readonly credits: Credits;
  readonly unlocks: readonly UnlockKey[];
}

export interface ApplyUpgradeInput {
  readonly orderId: string;
  readonly paymentId: string;
  readonly subscriptionId: string;
  readonly newPlanId: string;
  readonly topUp: Credits;
  readonly unlocks: readonly UnlockKey[];
  readonly periodStart: Date;
  readonly periodEnd: Date;
}

export interface PaymentRepository {
  create(payment: NewPayment): Promise<void>;
  findByOrderId(orderId: string): Promise<PaymentRecord | null>;
  findByPaymentId(paymentId: string): Promise<PaymentRecord | null>;
  /** One transaction: payment -> paid, credits + unlocks granted, audit row. No-op if already paid. */
  grantPack(input: GrantPackInput): Promise<{ readonly granted: boolean }>;
  /** One transaction: payment -> paid, current period topped up once, plan_id set, audit row. */
  applyUpgrade(input: ApplyUpgradeInput): Promise<{ readonly granted: boolean }>;
  /** Removes the unused part of what this payment granted (never below 0). Idempotent per refund id. */
  revokeOnRefund(paymentId: string, refundId: string): Promise<void>;
}

export interface WebhookEventRepository {
  /** Stores the event id; false if it was already seen (replay/duplicate). */
  record(eventId: string, type: string, ref: string | null): Promise<boolean>;
  finish(eventId: string, result: string): Promise<void>;
}

export interface SubscriptionRecord {
  readonly id: string;
  readonly userId: string;
  readonly product: ProductId;
  readonly planId: string;
  readonly pendingPlanId: string | null;
  readonly status: SubscriptionStatus;
  readonly providerSubscriptionId: string;
  readonly currentPeriodStart: Date | null;
  readonly currentPeriodEnd: Date | null;
  readonly cancelAtPeriodEnd: boolean;
  readonly lastEventAt: Date | null;
}

export interface ApplySubscriptionEvent {
  readonly providerSubscriptionId: string;
  readonly status: SubscriptionStatus;
  readonly eventAt: Date;
  readonly periodStart: Date | null;
  readonly periodEnd: Date | null;
}

export interface GrantPeriodInput {
  readonly subscriptionId: string;
  readonly planId: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly allowances: Credits;
  readonly unlocks: readonly UnlockKey[];
  /** Razorpay payment id of the charge that paid for this period (refunds look it up). */
  readonly paymentId: string | null;
}

export interface SubscriptionRepository {
  /** Throws SubscriptionExistsError if the user has a non-ended subscription for the product. */
  create(input: { userId: string; product: ProductId; planId: string; providerSubscriptionId: string }): Promise<SubscriptionRecord>;
  findByProviderId(providerSubscriptionId: string): Promise<SubscriptionRecord | null>;
  /** The user's non-ended subscription for the product, if any. */
  findCurrent(userId: string, product: ProductId): Promise<SubscriptionRecord | null>;
  listForUser(userId: string): Promise<readonly SubscriptionRecord[]>;
  listNonEnded(): Promise<readonly SubscriptionRecord[]>;
  /** Applies only allowed transitions and only if eventAt > last_event_at. */
  applyEvent(event: ApplySubscriptionEvent): Promise<{ readonly applied: boolean; readonly record: SubscriptionRecord | null }>;
  /** Grants one period's allowance + plan unlocks. Unique per (subscription, period_start). */
  grantPeriod(input: GrantPeriodInput): Promise<{ readonly granted: boolean }>;
  setCancelAtPeriodEnd(subscriptionId: string, value: boolean): Promise<void>;
  setPendingPlan(subscriptionId: string, planId: string | null): Promise<void>;
  setPlan(subscriptionId: string, planId: string): Promise<void>;
  /** Credits consumed from this period's allowance (for the refund policy). */
  periodUsage(subscriptionId: string, periodStart: Date): Promise<number>;
  revokePeriod(subscriptionId: string, periodStart: Date): Promise<void>;
  /** The period a subscription charge paid for, found by its payment id. */
  findPeriodByPaymentId(paymentId: string): Promise<{ readonly subscriptionId: string; readonly periodStart: Date } | null>;
}
