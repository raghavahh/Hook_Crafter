import type { Catalog } from '@hook/domain';
import type {
  AccountRepository,
  AdminRepository,
  AiBudgetRepository,
  AuditLog,
  EntitlementRepository,
  GenerationRepository,
  PaymentRepository,
  QuotaRepository,
  SubscriptionRepository,
  SwipeHookRepository,
  WebhookEventRepository,
} from './ports';
import * as mem from './infrastructure/memory';
import * as sb from './infrastructure/supabase';
import type { AppConfig } from './config/env';

export interface Repositories {
  readonly entitlements: EntitlementRepository;
  readonly quotas: QuotaRepository;
  readonly aiBudget: AiBudgetRepository;
  readonly payments: PaymentRepository;
  readonly webhookEvents: WebhookEventRepository;
  readonly subscriptions: SubscriptionRepository;
  readonly swipes: SwipeHookRepository;
  readonly generations: GenerationRepository;
  readonly accounts: AccountRepository;
  readonly audit: AuditLog;
  readonly admin: AdminRepository;
}

function planPrices(catalog: Catalog): Record<string, number> {
  return Object.fromEntries(catalog.plans('hooks').map((p) => [p.id, p.price.paise]));
}

/** One shared in-memory store per isolate (development only). */
let devStore: mem.InMemoryStore | null = null;

export function memoryRepositories(catalog: Catalog): Repositories {
  devStore ??= new mem.InMemoryStore();
  const s = devStore;
  return {
    entitlements: new mem.InMemoryEntitlementRepository(s),
    quotas: new mem.InMemoryQuotaRepository(s),
    aiBudget: new mem.InMemoryAiBudgetRepository(s),
    payments: new mem.InMemoryPaymentRepository(s),
    webhookEvents: new mem.InMemoryWebhookEventRepository(s),
    subscriptions: new mem.InMemorySubscriptionRepository(s),
    swipes: new mem.InMemorySwipeHookRepository(s),
    generations: new mem.InMemoryGenerationRepository(s),
    accounts: new mem.InMemoryAccountRepository(s),
    audit: new mem.InMemoryAuditLog(s),
    admin: new mem.InMemoryAdminRepository(s, planPrices(catalog)),
  };
}

export function supabaseRepositories(config: AppConfig, catalog: Catalog): Repositories {
  if (config.SUPABASE_URL === undefined || config.SUPABASE_SECRET_KEY === undefined) {
    throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY are required');
  }
  const t = new sb.PostgrestRpcTransport({ url: config.SUPABASE_URL, serviceKey: config.SUPABASE_SECRET_KEY });
  return {
    entitlements: new sb.SupabaseEntitlementRepository(t),
    quotas: new sb.SupabaseQuotaRepository(t),
    aiBudget: new sb.SupabaseAiBudgetRepository(t),
    payments: new sb.SupabasePaymentRepository(t),
    webhookEvents: new sb.SupabaseWebhookEventRepository(t),
    subscriptions: new sb.SupabaseSubscriptionRepository(t),
    swipes: new sb.SupabaseSwipeHookRepository(t),
    generations: new sb.SupabaseGenerationRepository(t),
    accounts: new sb.SupabaseAccountRepository(t),
    audit: new sb.SupabaseAuditLog(t),
    admin: new sb.SupabaseAdminRepository(t, planPrices(catalog)),
  };
}
