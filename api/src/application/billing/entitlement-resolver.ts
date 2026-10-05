import {
  AccessProfile,
  BillingPastDueError,
  ForbiddenError,
  NoCreditsError,
  QuotaExceededError,
  type Catalog,
  type FeatureKey,
  type ProductId,
} from '@hook/domain';
import type { Clock, EntitlementRepository, EntitlementSummary, QuotaRepository, SubscriptionRepository } from '../../ports';
import { dayKey } from '../time';

export type Grant =
  | { readonly kind: 'entitlement'; readonly reservationId: string; readonly paid: true }
  | { readonly kind: 'free'; readonly subject: string; readonly bucket: string; readonly paid: false };

export interface AccessState {
  readonly profile: AccessProfile;
  readonly summary: EntitlementSummary;
  readonly billingPastDue: boolean;
}

const FREE_FEATURE = 'free:generate';

/**
 * The ONLY place that decides access, limits and consumption priority (PRD A6.6):
 * monthly_allowance -> one_time_credit (both inside reserve()) -> free daily quota -> deny.
 */
export class EntitlementResolver {
  readonly #entitlements: EntitlementRepository;
  readonly #quotas: QuotaRepository;
  readonly #subscriptions: SubscriptionRepository;
  readonly #catalog: Catalog;
  readonly #clock: Clock;

  public constructor(deps: {
    entitlements: EntitlementRepository;
    quotas: QuotaRepository;
    subscriptions: SubscriptionRepository;
    catalog: Catalog;
    clock: Clock;
  }) {
    this.#entitlements = deps.entitlements;
    this.#quotas = deps.quotas;
    this.#subscriptions = deps.subscriptions;
    this.#catalog = deps.catalog;
    this.#clock = deps.clock;
  }

  public async access(userId: string, product: ProductId): Promise<AccessState> {
    const now = this.#clock.now();
    const [summary, current] = await Promise.all([
      this.#entitlements.summary(userId, product, now),
      this.#subscriptions.findCurrent(userId, product),
    ]);
    const profile = AccessProfile.compute(this.#catalog, product, {
      unlocks: new Set(summary.unlocks),
      activePlanId: summary.activePlanId,
      hasPaidPack: summary.hasPaidPack,
    });
    return { profile, summary, billingPastDue: current?.status === 'past_due' };
  }

  /**
   * Reserves one unit. `allowFree` is true only after a bot check passed (ADR-0003 D6).
   * Throws NO_CREDITS / QUOTA_EXCEEDED / BILLING_PAST_DUE when nothing is available.
   */
  public async reserve(userId: string, product: ProductId, feature: FeatureKey, allowFree: boolean): Promise<Grant> {
    const now = this.#clock.now();
    const reservation = await this.#entitlements.reserve(userId, product, feature, now);
    if (reservation !== null) return { kind: 'entitlement', reservationId: reservation.id, paid: true };
    const pastDue = (await this.#subscriptions.findCurrent(userId, product))?.status === 'past_due';
    if (feature !== 'generate') throw pastDue ? new BillingPastDueError() : new NoCreditsError();
    if (!allowFree) throw new ForbiddenError('Please complete the quick bot check to use your free generation.');
    const subject = `u:${userId}`;
    const bucket = dayKey(now);
    const ok = await this.#quotas.increment(subject, product, FREE_FEATURE, bucket, this.#catalog.free.dailyGenerate);
    if (!ok) throw pastDue ? new BillingPastDueError() : new QuotaExceededError();
    return { kind: 'free', subject, bucket, paid: false };
  }

  public async commit(grant: Grant): Promise<void> {
    if (grant.kind === 'entitlement') await this.#entitlements.commit(grant.reservationId);
  }

  /** Failed generation: the credit goes back to the same source it came from (US-11). */
  public async release(grant: Grant, product: ProductId): Promise<void> {
    if (grant.kind === 'entitlement') {
      await this.#entitlements.release(grant.reservationId);
      return;
    }
    await this.#quotas.decrement(grant.subject, product, FREE_FEATURE, grant.bucket);
  }

  public async freeLeftToday(userId: string, product: ProductId): Promise<number> {
    const used = await this.#quotas.get(`u:${userId}`, product, FREE_FEATURE, dayKey(this.#clock.now()));
    return Math.max(0, this.#catalog.free.dailyGenerate - used);
  }
}
