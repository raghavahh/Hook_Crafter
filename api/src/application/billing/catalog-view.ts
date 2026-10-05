import type { Catalog, CatalogResponse, ProductId } from '@hook/domain';
import type { ProviderEnv } from './billing-cycle-service';

/** Display-only prices (B5 GET /v1/billing/catalog). The browser never sends these back. */
export function catalogView(catalog: Catalog, product: ProductId, env: ProviderEnv): CatalogResponse {
  return {
    packs: catalog.packs(product).map((p) => ({
      id: p.id,
      name: p.name,
      pricePaise: p.price.paise,
      credits: { ...p.credits },
      unlocks: [...p.unlocks],
    })),
    plans: catalog.plans(product).map((p) => ({
      id: p.id,
      name: p.name,
      pricePaise: p.price.paise,
      allowances: { ...p.allowances },
      unlocks: [...p.unlocks],
      swipeLimit: p.swipeLimit,
      voiceProfileLimit: p.voiceProfileLimit,
      rateLimitPerHour: p.rateLimitPerHour,
      priority: p.aiTier === 'priority',
      available: p.providerPlanIds[env] !== null,
    })),
    free: { dailyGenerate: catalog.free.dailyGenerate, swipeLimit: catalog.free.swipeLimit },
  };
}
