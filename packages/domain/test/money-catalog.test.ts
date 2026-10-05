import { describe, expect, it } from 'vitest';
import { AccessProfile, CATALOG, InvariantViolation, Money } from '../src';

describe('Money', () => {
  it('stores integer paise and formats rupees', () => {
    expect(Money.ofRupees(99).paise).toBe(9900);
    expect(Money.ofPaise(9950).format()).toBe('₹99.50');
    expect(Money.ofRupees(1000).format()).toBe('₹1,000');
  });
  it('rejects negative, fractional and unsafe values', () => {
    expect(() => Money.ofPaise(-1)).toThrow(InvariantViolation);
    expect(() => Money.ofPaise(1.5)).toThrow(InvariantViolation);
    expect(() => Money.ofRupees(0.5)).toThrow(InvariantViolation);
    expect(() => Money.ofPaise(Number.MAX_SAFE_INTEGER + 1)).toThrow(InvariantViolation);
  });
  it('never goes below zero on minus', () => {
    expect(() => Money.ofRupees(1).minus(Money.ofRupees(2))).toThrow(InvariantViolation);
    expect(Money.ofRupees(399).minus(Money.ofRupees(149)).paise).toBe(25000);
  });
});

describe('Catalog (PRD A6)', () => {
  it('has the three packs with server prices', () => {
    expect(CATALOG.pack('hooks', 'creator')?.price.paise).toBe(9900);
    expect(CATALOG.pack('hooks', 'pro_creator')?.credits).toEqual({ generate: 100, post_rewrite: 20 });
    expect(CATALOG.pack('hooks', 'studio')?.unlocks).toEqual(['reels', 'all_languages']);
  });
  it('has the three monthly plans ordered by rank', () => {
    expect(CATALOG.plans('hooks').map((p) => p.id)).toEqual(['creator_monthly', 'pro_monthly', 'studio_monthly']);
    expect(CATALOG.plan('hooks', 'studio_monthly')?.rateLimitPerHour).toBe(60);
  });
  it('never returns another product or an unknown id', () => {
    expect(CATALOG.pack('roaster', 'creator')).toBeUndefined();
    expect(CATALOG.plan('hooks', 'nope')).toBeUndefined();
  });
  it('injects provider plan ids per environment', () => {
    const c = CATALOG.withProviderPlanIds({ pro_monthly: { test: 'plan_T1', live: null } });
    expect(c.planByProviderId('plan_T1', 'test')?.id).toBe('pro_monthly');
    expect(c.planByProviderId('plan_T1', 'live')).toBeUndefined();
  });
});

describe('AccessProfile (PRD A6.5)', () => {
  const none = new Set<never>();
  it('free user: 50 swipes, free tier, no unlocks', () => {
    const p = AccessProfile.compute(CATALOG, 'hooks', { unlocks: none, activePlanId: null, hasPaidPack: false });
    expect(p.swipeLimit).toBe(50);
    expect(p.aiTier).toBe('free');
    expect(p.unlockList()).toEqual([]);
  });
  it('pack buyer: 500 swipes, paid tier', () => {
    const p = AccessProfile.compute(CATALOG, 'hooks', { unlocks: new Set(['reels' as const]), activePlanId: null, hasPaidPack: true });
    expect(p.swipeLimit).toBe(500);
    expect(p.aiTier).toBe('paid');
    expect(p.has('reels')).toBe(true);
  });
  it('studio monthly: highest limits win', () => {
    const p = AccessProfile.compute(CATALOG, 'hooks', { unlocks: none, activePlanId: 'studio_monthly', hasPaidPack: true });
    expect(p.swipeLimit).toBe(2000);
    expect(p.rateLimitPerHour).toBe(60);
    expect(p.aiTier).toBe('priority');
    expect(p.voiceProfileLimit).toBe(10);
  });
});
