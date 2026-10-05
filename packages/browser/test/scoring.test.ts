import type { Language, Platform } from '@hook/domain';
import { describe, expect, it } from 'vitest';
import {
  ClarityScorer,
  CuriosityScorer,
  EmotionScorer,
  HookScorer,
  PlatformFitScorer,
  SpecificityScorer,
  TextSanitizer,
  type DimensionScorer,
  type ScoringInput,
} from '../src';
import { tokenize } from '../src/scoring/features';
import { lexiconFor } from '../src/scoring/lexicon';

function input(text: string, language: Language = 'en', platform: Platform = 'linkedin'): ScoringInput {
  const clean = TextSanitizer.clean(text);
  return { text: clean, platform, language, words: tokenize(clean) };
}

function points(scorer: DimensionScorer, text: string, language: Language = 'en', platform: Platform = 'linkedin'): number {
  return scorer.score(input(text, language, platform)).points;
}

describe('CuriosityScorer', () => {
  const scorer = new CuriosityScorer();
  it('scores a question with a curiosity word', () => {
    expect(points(scorer, 'Why do most diets fail?')).toBe(10);
  });
  it('caps open loops, contrast and a trailing ellipsis at 20 and drops the tip', () => {
    const result = scorer.score(input("Here's the truth about sleep. Nobody tells you this…"));
    expect(result.points).toBe(20);
    expect(result.tip).toBeNull();
  });
  it('gives 6 for one open loop and 4 for a trailing colon', () => {
    expect(points(scorer, 'Here is the plan')).toBe(6);
    expect(points(scorer, 'Three lessons from my startup:')).toBe(4);
  });
  it('gives 0 and a tip to a flat statement', () => {
    const result = scorer.score(input('Sales calls are boring'));
    expect(result).toEqual({ key: 'curiosity', points: 0, tip: expect.any(String) });
  });
  it('reads Hinglish and Hindi curiosity words', () => {
    expect(points(scorer, 'Sabse badi galti kyun?', 'hinglish')).toBe(14);
    expect(points(scorer, 'सबसे बड़ी गलती क्यों?', 'hi')).toBe(14);
  });
});

describe('SpecificityScorer', () => {
  const scorer = new SpecificityScorer();
  it('rewards numbers, named things and a first-person story (clamped to 20)', () => {
    expect(points(scorer, 'I grew revenue 40% in 3 months at Zomato and Swiggy.')).toBe(20);
  });
  it('penalises vague words down to 0', () => {
    expect(points(scorer, 'Some things are very important.')).toBe(0);
  });
  it('counts number words but not a capital at the start of a sentence', () => {
    expect(points(scorer, 'Ten habits changed everything.')).toBe(5);
  });
  it('counts one named thing mid-sentence', () => {
    expect(points(scorer, 'Lessons from Bangalore traffic')).toBe(5);
  });
  it('reads Hinglish and Hindi numbers and first person', () => {
    expect(points(scorer, 'Maine 2 saal mein ek galti seekhi.', 'hinglish')).toBe(15);
    expect(points(scorer, 'मैंने 2 साल में एक गलती की।', 'hi')).toBe(15);
    expect(points(scorer, 'मैंने ३ साल लगाए', 'hi')).toBe(12);
  });
});

describe('EmotionScorer', () => {
  const scorer = new EmotionScorer();
  it('rewards power words and one exclamation mark', () => {
    expect(points(scorer, 'I lost everything and failed twice!')).toBe(18);
  });
  it('gives a neutral line the base score', () => {
    expect(points(scorer, 'Meeting notes for Tuesday')).toBe(4);
  });
  it('penalises shouting and rewards one emoji', () => {
    expect(points(scorer, 'Big news!!!')).toBe(2);
    expect(points(scorer, 'Big news 🚀')).toBe(6);
  });
  it('caps at 20 with no tip', () => {
    const result = scorer.score(input('Proud, honest and brutal. Never again! 🔥'));
    expect(result.points).toBe(20);
    expect(result.tip).toBeNull();
  });
  it('reads Hinglish and Hindi power words', () => {
    expect(points(scorer, 'Yaar, sabse badi galti', 'hinglish')).toBe(16);
    expect(points(scorer, 'सबसे बड़ा डर', 'hi')).toBe(16);
  });
});

describe('ClarityScorer', () => {
  const scorer = new ClarityScorer();
  it('gives full marks to 6-20 short words', () => {
    expect(points(scorer, 'I lost my first client because of one email I never sent.')).toBe(20);
  });
  it('scores very short and long-word text lower', () => {
    expect(points(scorer, 'Hello')).toBe(11);
    expect(points(scorer, 'Internationalization responsibilities')).toBe(5);
    expect(points(scorer, '???')).toBe(11);
  });
  it('gives 5 for 21-30 words', () => {
    expect(points(scorer, Array.from({ length: 25 }, () => 'go').join(' '))).toBe(15);
  });
  it('penalises jargon and clichés', () => {
    expect(points(scorer, 'Leverage synergy for holistic scalable outcomes today')).toBe(8);
    expect(points(scorer, 'At the end of the day, I am thrilled to share this.')).toBe(8);
  });
  it('reads Hinglish and Hindi clichés', () => {
    expect(points(scorer, 'Aaj ke daur mein social media zaroori hai', 'hinglish')).toBe(14);
    expect(points(scorer, 'आज के दौर में सोशल मीडिया ज़रूरी है', 'hi')).toBe(14);
  });
});

describe('PlatformFitScorer', () => {
  const scorer = new PlatformFitScorer();
  it('gives 20 when the key idea and the hook fit', () => {
    expect(points(scorer, 'Short and sweet.', 'en', 'shorts_title')).toBe(20);
  });
  it('scales down when the key idea runs past the cut-off', () => {
    expect(points(scorer, 'a'.repeat(90), 'en', 'shorts_title')).toBe(17);
    expect(points(scorer, 'a'.repeat(120), 'en', 'shorts_title')).toBe(11);
    expect(points(scorer, 'a'.repeat(200), 'en', 'shorts_title')).toBe(4);
  });
  it('keeps the landing points when only the tail is too long', () => {
    expect(points(scorer, `Short first line.\n${'b'.repeat(300)}`, 'en', 'shorts_title')).toBe(12);
  });
  it('names the platform cut-off in its tip', () => {
    expect(scorer.score(input('a'.repeat(200), 'en', 'shorts_title')).tip).toContain('70');
  });
});

describe('HookScorer', () => {
  const scorer = new HookScorer();
  it('returns zeros and one tip for empty or whitespace text', () => {
    for (const text of ['', '   \n\t ', '‮​']) {
      const score = scorer.score(text, 'linkedin', 'en');
      expect(score.total).toBe(0);
      expect(Object.values(score.dimensions)).toEqual([0, 0, 0, 0, 0]);
      expect(score.tips).toEqual(['Type a first line to get a score.']);
    }
  });
  it('is deterministic and sums the dimensions', () => {
    const text = 'I quit Google after 7 years. Here is what nobody tells you about leaving Big Tech!';
    const a = scorer.score(text, 'x', 'en');
    expect(scorer.score(text, 'x', 'en')).toEqual(a);
    expect(a.total).toBe(Object.values(a.dimensions).reduce((sum, n) => sum + n, 0));
    expect(a.total).toBe(87);
  });
  it('sanitises first: bidi and zero-width characters do not change the score', () => {
    const clean = 'I lost my first client because of one email I never sent.';
    expect(scorer.score(`‮${clean.replace('client', 'cli​ent')}`, 'linkedin', 'en')).toEqual(
      scorer.score(clean, 'linkedin', 'en'),
    );
  });
  it.each<[Language, string, string]>([
    ['en', "In today's fast-paced world, social media is very important.", 'I lost my first client because of one email I never sent.'],
    ['en', 'Some things are very important for success.', 'Why I turned down a 40 lakh offer from Flipkart:'],
    ['hinglish', 'Aaj ke daur mein social media bahut important hai.', 'Maine sabse badi galti kyun ki? Sach sunoge yaar?'],
    ['hi', 'आज के दौर में सोशल मीडिया बहुत ज़रूरी है।', 'मैंने सबसे बड़ी गलती क्यों की? सच जानिए।'],
  ])('a good %s hook beats a bad one', (language, bad, good) => {
    expect(scorer.score(good, 'linkedin', language).total).toBeGreaterThan(scorer.score(bad, 'linkedin', language).total);
  });
  it('gives 3 tips when the third-weakest dimension is clearly weak, else 2', () => {
    const bad = scorer.score("In today's fast-paced world, social media is very important.", 'linkedin', 'en');
    expect(bad.tips).toHaveLength(3);
    expect(bad.tips[0]).toContain('Open a loop');
    const good = scorer.score('I lost my first client because of one email I never sent.', 'linkedin', 'en');
    expect(good.tips).toHaveLength(2);
  });
  it('falls back to script-agnostic signals for other languages', () => {
    expect(lexiconFor('te').power.size).toBe(0);
    const score = scorer.score('మీకు తెలుసా? 3 రహస్యాలు', 'x', 'te');
    expect(score.dimensions.curiosity).toBe(6);
    expect(score.dimensions.specificity).toBe(8);
  });
  it('pads with polish tips, clamps bad values and zero-fills missing dimensions', () => {
    const perfect: DimensionScorer = { key: 'curiosity', score: () => ({ key: 'curiosity', points: 20, tip: null }) };
    const broken: DimensionScorer = { key: 'emotion', score: () => ({ key: 'emotion', points: Number.NaN, tip: 'x' }) };
    const big: DimensionScorer = { key: 'clarity', score: () => ({ key: 'clarity', points: 99, tip: null }) };
    const score = new HookScorer([perfect, broken, big]).score('hello', 'linkedin', 'en');
    expect(score.dimensions).toEqual({ curiosity: 20, specificity: 0, emotion: 0, clarity: 20, platformFit: 0 });
    expect(score.total).toBe(40);
    expect(score.tips).toEqual(['x', expect.stringContaining('Strong hook')]);
    expect(new HookScorer([perfect]).score('hello', 'linkedin', 'en').tips).toHaveLength(2);
  });
  it('scores 500 characters in under 5 ms on average', () => {
    const text = 'I lost my first client because of one email I never sent. '.repeat(9).slice(0, 500);
    for (let i = 0; i < 20; i += 1) scorer.score(text, 'linkedin', 'en');
    const runs = 50;
    const start = performance.now();
    for (let i = 0; i < runs; i += 1) scorer.score(text, 'linkedin', 'en');
    expect((performance.now() - start) / runs).toBeLessThan(5);
  });
});
