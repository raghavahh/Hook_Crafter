import { THIS_PRODUCT, type MeResponse } from '@hook/domain';
import type { AccountRepository, Clock, GenerationRepository, IdentityAdmin, Logger, SubscriptionRepository, SwipeHookRepository } from '../../ports';
import type { EntitlementResolver } from '../billing/entitlement-resolver';
import type { SubscriptionService } from '../billing/subscription-service';
import { dayKey, DAY_MS } from '../time';

/** /v1/me, export and delete (US-12, DPDP export + delete). */
export class AccountService {
  readonly #accounts: AccountRepository;
  readonly #resolver: EntitlementResolver;
  readonly #subscriptions: SubscriptionRepository;
  readonly #subscriptionService: SubscriptionService;
  readonly #swipes: SwipeHookRepository;
  readonly #generations: GenerationRepository;
  readonly #identity: IdentityAdmin;
  readonly #clock: Clock;
  readonly #logger: Logger;

  public constructor(deps: {
    accounts: AccountRepository;
    resolver: EntitlementResolver;
    subscriptions: SubscriptionRepository;
    subscriptionService: SubscriptionService;
    swipes: SwipeHookRepository;
    generations: GenerationRepository;
    identity: IdentityAdmin;
    clock: Clock;
    logger: Logger;
  }) {
    this.#accounts = deps.accounts;
    this.#resolver = deps.resolver;
    this.#subscriptions = deps.subscriptions;
    this.#subscriptionService = deps.subscriptionService;
    this.#swipes = deps.swipes;
    this.#generations = deps.generations;
    this.#identity = deps.identity;
    this.#clock = deps.clock;
    this.#logger = deps.logger;
  }

  /** Every value here comes from the server (US-15). Also records signup + daily activity. */
  public async me(userId: string): Promise<MeResponse> {
    const now = this.#clock.now();
    await this.#accounts.ensureProfile(userId);
    await this.#accounts.touchActivity(userId, dayKey(now));
    const [access, freeLeft, swipeCount, subs, history] = await Promise.all([
      this.#resolver.access(userId, THIS_PRODUCT),
      this.#resolver.freeLeftToday(userId, THIS_PRODUCT),
      this.#swipes.count(userId),
      this.#subscriptions.listForUser(userId),
      this.#generations.listSince(userId, THIS_PRODUCT, new Date(now.getTime() - 30 * DAY_MS), 10),
    ]);
    return {
      userId,
      credits: { generate: access.summary.credits.generate, post_rewrite: access.summary.credits.post_rewrite },
      freeGenerateLeftToday: freeLeft,
      unlocks: access.profile.unlockList(),
      swipeLimit: access.profile.swipeLimit,
      swipeCount,
      rateLimitPerHour: access.profile.rateLimitPerHour,
      voiceProfileLimit: access.profile.voiceProfileLimit,
      aiTier: access.profile.aiTier,
      billingPastDue: access.billingPastDue,
      subscriptions: subs
        .filter((s) => s.product === THIS_PRODUCT)
        .map((s) => ({
          id: s.id,
          product: s.product,
          planId: s.planId,
          pendingPlanId: s.pendingPlanId,
          status: s.status,
          currentPeriodEnd: s.currentPeriodEnd?.toISOString() ?? null,
          cancelAtPeriodEnd: s.cancelAtPeriodEnd,
        })),
      history: history.map((h) => ({ id: h.id, feature: h.feature, createdAt: h.createdAt.toISOString(), title: h.title })),
    };
  }

  public exportData(userId: string): Promise<unknown> {
    return this.#accounts.exportData(userId);
  }

  /** Cancel every subscription FIRST (no further charges), then delete data, then the auth user. */
  public async delete(userId: string): Promise<void> {
    await this.#subscriptionService.cancelAllNow(userId);
    await this.#accounts.deleteAccount(userId);
    await this.#identity.deleteUser(userId).catch(() => this.#logger.error('identity_delete_failed', { step: 'auth_user' }));
    this.#logger.info('account_deleted');
  }

  public isDeleted(userId: string): Promise<boolean> {
    return this.#accounts.isDeleted(userId);
  }
}
