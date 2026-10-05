import { CATALOG, type Catalog } from '@hook/domain';
import { AccountService } from './application/account/account-service';
import { AdminService } from './application/account/admin-service';
import { LlmRouter } from './application/ai/llm-router';
import { cryptoNonce } from './application/ai/prompt-builder';
import { BillingCycleService } from './application/billing/billing-cycle-service';
import { BillingReconciler } from './application/billing/billing-reconciler';
import { CheckoutService } from './application/billing/checkout-service';
import { EntitlementResolver } from './application/billing/entitlement-resolver';
import { PaymentVerificationService } from './application/billing/payment-verification-service';
import { PlanChangeService } from './application/billing/plan-change-service';
import { RateLimiter } from './application/billing/rate-limiter';
import { SubscriptionService } from './application/billing/subscription-service';
import { SubscriptionStateResolver } from './application/billing/subscription-state-resolver';
import { PaymentCapturedHandler, PaymentFailedHandler, RefundProcessedHandler } from './application/billing/webhooks/payment-handlers';
import { SubscriptionEventHandler } from './application/billing/webhooks/subscription-handler';
import { WebhookService } from './application/billing/webhooks/webhook-service';
import { ContentPolicy } from './application/hooks/content-policy';
import { GenerationPipeline } from './application/hooks/generation-pipeline';
import { HistoryService } from './application/hooks/history-service';
import { HookGenerationService } from './application/hooks/hook-generation-service';
import { PostRewriteService } from './application/hooks/post-rewrite-service';
import { ReelsScriptService } from './application/hooks/reels-script-service';
import { SwipeFileService } from './application/hooks/swipe-file-service';
import { parseEnv, planIdsFrom, type AppConfig } from './config/env';
import * as adapters from './container-adapters';
import { memoryRepositories, supabaseRepositories, type Repositories } from './container-repos';
import type { AppServices, HttpConfig } from './http/types';
import type { WorkersAiBinding } from './infrastructure/llm/workers-ai-provider';
import { JsonLogger, SystemClock } from './infrastructure/system/system';
import type { Clock, Logger, PaymentGateway, SubscriptionGateway } from './ports';

export interface Container {
  readonly services: AppServices;
  readonly http: HttpConfig;
  readonly reconciler: BillingReconciler;
}

interface Core {
  readonly config: AppConfig;
  readonly catalog: Catalog;
  readonly repos: Repositories;
  readonly clock: Clock;
  readonly logger: Logger;
  readonly gateway: PaymentGateway & SubscriptionGateway;
  readonly ai: WorkersAiBinding | null;
}

/** The composition root: the ONLY place that knows concrete adapters (Phase 3 rule 4). */
export function buildContainer(rawEnv: Readonly<Record<string, unknown>>, ai: WorkersAiBinding | null): Container {
  const config = parseEnv(rawEnv);
  const catalog = withPlanIds(config);
  const core: Core = {
    config,
    catalog,
    repos: config.USE_MEMORY_STORE ? memoryRepositories(catalog) : supabaseRepositories(config, catalog),
    clock: new SystemClock(),
    logger: new JsonLogger({ env: config.ENVIRONMENT }),
    gateway: adapters.razorpay(config),
    ai,
  };
  const billing = buildBilling(core);
  const services: AppServices = { ...buildProduct(core, billing.resolver, billing.rateLimiter), ...billing.services };
  return { services, http: httpConfig(config), reconciler: billing.reconciler };
}

function buildBilling(core: Core) {
  const { repos, catalog, clock, logger, gateway } = core;
  const env = core.config.RAZORPAY_ENV;
  const resolver = new EntitlementResolver({ entitlements: repos.entitlements, quotas: repos.quotas, subscriptions: repos.subscriptions, catalog, clock });
  const rateLimiter = new RateLimiter(repos.quotas, clock);
  const cycles = new BillingCycleService({ subscriptions: repos.subscriptions, catalog, env, logger });
  const stateResolver = new SubscriptionStateResolver({ subscriptions: repos.subscriptions, cycles, logger });
  const planChanges = new PlanChangeService({ catalog, subscriptions: repos.subscriptions, payments: repos.payments, paymentGateway: gateway, subscriptionGateway: gateway, env, logger });
  const payments = new PaymentVerificationService({ catalog, gateway, payments: repos.payments, planChanges, logger });
  const subscriptions = new SubscriptionService({ catalog, gateway, subscriptions: repos.subscriptions, resolver: stateResolver, env, clock, logger });
  const webhooks = new WebhookService({
    gateway,
    events: repos.webhookEvents,
    logger,
    handlers: [
      new PaymentCapturedHandler(repos.payments, payments),
      new PaymentFailedHandler(logger),
      new RefundProcessedHandler(repos.payments, repos.subscriptions, logger),
      new SubscriptionEventHandler({ subscriptions: repos.subscriptions, gateway, resolver: stateResolver, logger }),
    ],
  });
  const accounts = new AccountService({
    accounts: repos.accounts,
    resolver,
    subscriptions: repos.subscriptions,
    subscriptionService: subscriptions,
    swipes: repos.swipes,
    generations: repos.generations,
    identity: adapters.identityAdmin(core.config),
    clock,
    logger,
  });
  const reconciler = new BillingReconciler({ subscriptions: repos.subscriptions, gateway, resolver: stateResolver, audit: repos.audit, clock, logger });
  return {
    resolver,
    rateLimiter,
    reconciler,
    services: {
      accounts,
      checkout: new CheckoutService({ catalog, gateway, payments: repos.payments }),
      payments,
      subscriptions,
      planChanges,
      webhooks,
      admin: new AdminService({ repo: repos.admin, clock, adminUserIds: core.config.ADMIN_USER_IDS }),
    },
  };
}

function buildProduct(core: Core, resolver: EntitlementResolver, rateLimiter: RateLimiter) {
  const { repos, clock, logger, config } = core;
  const policy = new ContentPolicy(adapters.moderation(core.ai));
  const router = new LlmRouter({ tiers: adapters.tiers(config, core.ai), budget: repos.aiBudget, clock, logger });
  const pipeline = new GenerationPipeline({ resolver, rateLimiter, policy, router, bot: adapters.botVerifier(config), logger });
  const gen = { resolver, pipeline, policy, nonce: cryptoNonce };
  return {
    tokens: adapters.tokenVerifier(config),
    resolver,
    rateLimiter,
    hooks: new HookGenerationService({ ...gen, generations: repos.generations, clock, logger }),
    rewrite: new PostRewriteService(gen),
    reels: new ReelsScriptService({ ...gen, generations: repos.generations, clock, logger }),
    swipe: new SwipeFileService({ repo: repos.swipes, resolver, rateLimiter }),
    history: new HistoryService(repos.generations, clock),
    catalog: core.catalog,
    logger,
  };
}

function withPlanIds(config: AppConfig): Catalog {
  const env = config.RAZORPAY_ENV;
  const entries = Object.entries(planIdsFrom(config.RAZORPAY_PLAN_IDS)).map(([planId, providerId]) => [
    planId,
    env === 'test' ? { test: providerId, live: null } : { test: null, live: providerId },
  ]);
  return CATALOG.withProviderPlanIds(Object.fromEntries(entries));
}

function httpConfig(config: AppConfig): HttpConfig {
  return {
    allowedOrigins: config.ALLOWED_ORIGINS,
    switches: { killAi: config.KILL_AI, killPayments: config.KILL_PAYMENTS, readOnly: config.READ_ONLY },
    providerEnv: config.RAZORPAY_ENV,
    bodyLimit: 32 * 1024,
    burstPerMinute: 120,
  };
}
