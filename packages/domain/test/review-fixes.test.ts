import { describe, expect, it } from 'vitest';
import {
  AccessProfile,
  CATALOG,
  CatalogResponseSchema,
  GenerateRequestSchema,
  SubscriptionStateMachine,
  SwipeSaveRequestSchema,
  TextSanitizer,
} from '../src';

describe('review fixes', () => {
  it('TextSanitizer is idempotent and strips word joiners, soft hyphens and tag characters', () => {
    const once = TextSanitizer.clean('e​́');
    expect(TextSanitizer.clean(once)).toBe(once);
    expect(once).toBe('é');
    expect(TextSanitizer.clean('sc⁠am 1⁠000 so­ft \u{E0041}x')).toBe('scam 1000 soft x');
    expect(TextSanitizer.clean('क्‍ष')).toBe('क्‍ष');
  });

  it('catalog response with partial credits parses (Zod 4 partialRecord)', () => {
    const response = {
      packs: CATALOG.packs('hooks').map((p) => ({ id: p.id, name: p.name, pricePaise: p.price.paise, credits: { ...p.credits }, unlocks: [...p.unlocks] })),
      plans: [],
      free: { dailyGenerate: 1, swipeLimit: 50 },
    };
    expect(CatalogResponseSchema.safeParse(response).success).toBe(true);
  });

  it('blank optional fields mean "not provided"', () => {
    const out = GenerateRequestSchema.parse({ topic: 'x', platform: 'x', language: 'en', tone: 'bold', audience: '   ' });
    expect(out.audience).toBeUndefined();
    const swipe = SwipeSaveRequestSchema.parse({ text: 'hi', frameworkId: 'warning', platform: 'x', language: 'en', collection: '' });
    expect(swipe.collection).toBeUndefined();
  });

  it('allows the extra Razorpay transitions', () => {
    expect(SubscriptionStateMachine.canTransition('past_due', 'completed')).toBe(true);
    expect(SubscriptionStateMachine.canTransition('paused', 'halted')).toBe(true);
    expect(SubscriptionStateMachine.canTransition('halted', 'completed')).toBe(true);
  });

  it('a period for a removed plan id still counts as paid, and unlocks cannot be mutated', () => {
    const p = AccessProfile.compute(CATALOG, 'hooks', { unlocks: new Set(['reels' as const]), activePlanId: 'retired_plan', hasPaidPack: false });
    expect(p.swipeLimit).toBe(500);
    expect(p.aiTier).toBe('paid');
    (p.unlocks as Set<string>).add('hindi');
    expect(p.has('hindi')).toBe(false);
  });
});
