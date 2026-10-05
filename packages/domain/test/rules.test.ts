import { describe, expect, it } from 'vitest';
import {
  BillingPeriod,
  codePointLength,
  FRAMEWORKS,
  GenerateRequestSchema,
  graphemes,
  Hook,
  HookSet,
  InvariantViolation,
  isLanguageAllowed,
  SubscriptionStateMachine,
  TextSanitizer,
} from '../src';

describe('TextSanitizer (S-33)', () => {
  it('strips bidi overrides, zero-width space and BOM', () => {
    expect(TextSanitizer.clean('a‮b​c﻿d⁦e')).toBe('abcde');
  });
  it('keeps ZWJ/ZWNJ for Indic scripts and normalises to NFC', () => {
    const hindi = 'क्‍ष';
    expect(TextSanitizer.clean(hindi)).toBe(hindi);
    expect(TextSanitizer.clean('é')).toBe('é');
  });
  it('removes control characters but keeps newlines and tabs', () => {
    expect(TextSanitizer.clean('a\u0000b\r\nc\td')).toBe('ab\nc\td');
  });
  it('counts code points and graphemes', () => {
    expect(codePointLength('😀')).toBe(1);
    expect(graphemes('नमस्ते').length).toBeLessThan(codePointLength('नमस्ते'));
  });
});

describe('Hook + HookSet', () => {
  const make = (i: number) =>
    Hook.create({ text: `Hook number ${String(i)}`, frameworkId: 'contrarian', platform: 'linkedin' }, FRAMEWORKS);
  it('needs exactly 10 hooks', () => {
    expect(HookSet.create(Array.from({ length: 10 }, (_, i) => make(i))).hooks).toHaveLength(10);
    expect(() => HookSet.create([make(1)])).toThrow(InvariantViolation);
  });
  it('rejects unknown frameworks and over-length text', () => {
    expect(() => Hook.create({ text: 'x', frameworkId: 'made_up', platform: 'x' }, FRAMEWORKS)).toThrow(InvariantViolation);
    expect(() =>
      Hook.create({ text: 'a'.repeat(101), frameworkId: 'warning', platform: 'shorts_title' }, FRAMEWORKS),
    ).toThrow(InvariantViolation);
  });
  it('library has 25 unique frameworks', () => {
    expect(FRAMEWORKS.list().length).toBe(25);
  });
});

describe('Subscription state machine', () => {
  it('allows renewal and forbids going backwards', () => {
    expect(SubscriptionStateMachine.canTransition('active', 'active')).toBe(true);
    expect(SubscriptionStateMachine.canTransition('cancelled', 'active')).toBe(false);
    expect(SubscriptionStateMachine.canTransition('completed', 'past_due')).toBe(false);
    expect(SubscriptionStateMachine.isEnded('cancelled')).toBe(true);
    expect(SubscriptionStateMachine.isEnded('halted')).toBe(false);
  });
});

describe('BillingPeriod', () => {
  it('needs start < end', () => {
    const p = BillingPeriod.create(new Date('2026-01-01'), new Date('2026-02-01'));
    expect(p.contains(new Date('2026-01-15'))).toBe(true);
    expect(p.hasEnded(new Date('2026-02-01'))).toBe(true);
    expect(() => BillingPeriod.create(new Date('2026-02-01'), new Date('2026-01-01'))).toThrow(InvariantViolation);
  });
});

describe('Languages (A6.8)', () => {
  it('English and Hinglish are free; Hindi needs an unlock; regional stays disabled', () => {
    expect(isLanguageAllowed('hinglish', new Set())).toBe(true);
    expect(isLanguageAllowed('hi', new Set())).toBe(false);
    expect(isLanguageAllowed('hi', new Set(['all_languages']))).toBe(true);
    expect(isLanguageAllowed('te', new Set(['all_languages']))).toBe(false);
  });
});

describe('GenerateRequestSchema (strict)', () => {
  const base = { topic: 'Shipping my first SaaS', platform: 'linkedin', language: 'en', tone: 'bold' };
  it('accepts a valid request and sanitises the topic', () => {
    expect(GenerateRequestSchema.parse({ ...base, topic: '  hi‮ there  ' }).topic).toBe('hi there');
  });
  it('rejects extra fields (S-03, S-SUB-03) and reels_script', () => {
    expect(GenerateRequestSchema.safeParse({ ...base, userId: 'x' }).success).toBe(false);
    expect(GenerateRequestSchema.safeParse({ ...base, platform: 'reels_script' }).success).toBe(false);
  });
  it('accepts 5,000 Devanagari characters and rejects 5,001', () => {
    expect(GenerateRequestSchema.safeParse({ ...base, topic: 'क'.repeat(5000) }).success).toBe(true);
    expect(GenerateRequestSchema.safeParse({ ...base, topic: 'क'.repeat(5001) }).success).toBe(false);
  });
});
