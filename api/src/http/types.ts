import type { Catalog } from '@hook/domain';
import type { AccountService } from '../application/account/account-service';
import type { AdminService } from '../application/account/admin-service';
import type { EntitlementResolver } from '../application/billing/entitlement-resolver';
import type { CheckoutService } from '../application/billing/checkout-service';
import type { PaymentVerificationService } from '../application/billing/payment-verification-service';
import type { PlanChangeService } from '../application/billing/plan-change-service';
import type { RateLimiter } from '../application/billing/rate-limiter';
import type { SubscriptionService } from '../application/billing/subscription-service';
import type { ProviderEnv } from '../application/billing/billing-cycle-service';
import type { WebhookService } from '../application/billing/webhooks/webhook-service';
import type { HistoryService } from '../application/hooks/history-service';
import type { HookGenerationService } from '../application/hooks/hook-generation-service';
import type { PostRewriteService } from '../application/hooks/post-rewrite-service';
import type { ReelsScriptService } from '../application/hooks/reels-script-service';
import type { SwipeFileService } from '../application/hooks/swipe-file-service';
import type { Logger, Switches, TokenVerifier, VerifiedUser } from '../ports';

/** Everything the HTTP layer needs, built only in container.ts. */
export interface AppServices {
  readonly tokens: TokenVerifier;
  readonly accounts: AccountService;
  readonly admin: AdminService;
  readonly resolver: EntitlementResolver;
  readonly rateLimiter: RateLimiter;
  readonly hooks: HookGenerationService;
  readonly rewrite: PostRewriteService;
  readonly reels: ReelsScriptService;
  readonly swipe: SwipeFileService;
  readonly history: HistoryService;
  readonly checkout: CheckoutService;
  readonly payments: PaymentVerificationService;
  readonly subscriptions: SubscriptionService;
  readonly planChanges: PlanChangeService;
  readonly webhooks: WebhookService;
  readonly catalog: Catalog;
  readonly logger: Logger;
}

export interface HttpConfig {
  readonly allowedOrigins: readonly string[];
  readonly switches: Switches;
  readonly providerEnv: ProviderEnv;
  /** Bytes. 32 KB (ADR-0003 D4). */
  readonly bodyLimit: number;
  /** Requests per minute per IP, approximate (per Worker isolate). */
  readonly burstPerMinute: number;
}

export interface AppEnv {
  Variables: {
    requestId: string;
    rawBody: string;
    user: VerifiedUser;
  };
}
