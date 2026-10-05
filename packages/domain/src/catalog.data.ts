import { Catalog, Pack, Plan } from './catalog';
import { Money } from './money';

const rupees = (r: number): Money => Money.ofRupees(r);
const NO_PROVIDER_IDS = { test: null, live: null } as const;

/**
 * Prices and limits are starting hypotheses (PRD A6). Razorpay plan ids are
 * injected per environment via Catalog.withProviderPlanIds().
 */
export const CATALOG = new Catalog(
  [
    Pack.create({ id: 'creator', product: 'hooks', name: 'Creator', price: rupees(99), credits: { generate: 30 }, unlocks: [] }),
    Pack.create({
      id: 'pro_creator',
      product: 'hooks',
      name: 'Pro Creator',
      price: rupees(249),
      credits: { generate: 100, post_rewrite: 20 },
      unlocks: ['reels', 'hindi'],
    }),
    Pack.create({
      id: 'studio',
      product: 'hooks',
      name: 'Studio',
      price: rupees(599),
      credits: { generate: 300, post_rewrite: 60 },
      unlocks: ['reels', 'all_languages'],
    }),
  ],
  [
    Plan.create({
      id: 'creator_monthly',
      product: 'hooks',
      name: 'Creator Monthly',
      price: rupees(149),
      allowances: { generate: 30 },
      unlocks: ['voice_profiles', 'collections'],
      aiTier: 'paid',
      rateLimitPerHour: 30,
      swipeLimit: 500,
      voiceProfileLimit: 1,
      rank: 1,
      providerPlanIds: NO_PROVIDER_IDS,
    }),
    Plan.create({
      id: 'pro_monthly',
      product: 'hooks',
      name: 'Pro Monthly',
      price: rupees(399),
      allowances: { generate: 100, post_rewrite: 20 },
      unlocks: ['reels', 'hindi', 'voice_profiles', 'collections', 'batch'],
      aiTier: 'priority',
      rateLimitPerHour: 30,
      swipeLimit: 500,
      voiceProfileLimit: 3,
      rank: 2,
      providerPlanIds: NO_PROVIDER_IDS,
    }),
    Plan.create({
      id: 'studio_monthly',
      product: 'hooks',
      name: 'Studio Monthly',
      price: rupees(799),
      allowances: { generate: 300, post_rewrite: 60 },
      unlocks: ['reels', 'all_languages', 'voice_profiles', 'collections', 'batch'],
      aiTier: 'priority',
      rateLimitPerHour: 60,
      swipeLimit: 2000,
      voiceProfileLimit: 10,
      rank: 3,
      providerPlanIds: NO_PROVIDER_IDS,
    }),
  ],
  { dailyGenerate: 1, swipeLimit: 50, rateLimitPerHour: 30 },
  { swipeLimit: 500, rateLimitPerHour: 30 },
);
