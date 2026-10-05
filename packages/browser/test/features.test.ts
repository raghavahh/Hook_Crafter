import { describe, expect, it } from 'vitest';
import { EmotionScorer, HookScorer, TextSanitizer } from '../src';
import { countMidSentenceCapitals, firstSentence, hasEmoji, tokenize } from '../src/scoring/features';
import { MAX_SCORED_CODE_POINTS } from '../src/scoring/hook-scorer';

describe('tokenize', () => {
  it('never turns emoji pieces (VS16, ZWJ) into words', () => {
    expect(tokenize('I lost ❤\uFE0F it')).toEqual(['I', 'lost', 'it']);
    expect(tokenize('\u{1F468}\u200D\u{1F469}\u200D\u{1F467} family \u{1F44D}\u{1F3FD}')).toEqual(['family']);
    expect(tokenize('\uFE0F\u200D́')).toEqual([]);
  });
  it('keeps Indic matras, ZWNJ/ZWJ and inner apostrophes inside words', () => {
    expect(tokenize('मैंने सबसे बड़ी गलती की।')).toEqual(['मैंने', 'सबसे', 'बड़ी', 'गलती', 'की']);
    expect(tokenize('क्\u200Dष')).toEqual(['क्\u200Dष']);
    expect(tokenize("today's world's 'quoted'")).toEqual(["today's", "world's", 'quoted']);
  });
});

describe('hasEmoji', () => {
  it('counts real emoji only, not ©, ® or ™', () => {
    for (const text of ['© 2026', 'Brand®', 'Name™', '❤ plain heart']) expect(hasEmoji(text)).toBe(false);
    for (const text of ['\u{1F525}', '❤\uFE0F', '\u{1F44D}\u{1F3FD}']) expect(hasEmoji(text)).toBe(true);
  });
  it('gives no emoji bonus for a trademark sign', () => {
    const scorer = new EmotionScorer();
    const score = (text: string): number => {
      const clean = TextSanitizer.clean(text);
      return scorer.score({ text: clean, platform: 'linkedin', language: 'en', words: tokenize(clean) }).points;
    };
    expect(score('Acme™ launch')).toBe(4);
    expect(score('Acme launch \u{1F680}')).toBe(6);
  });
});

describe('firstSentence', () => {
  it('ends at a terminator run followed by space, or at a newline', () => {
    expect(firstSentence('  Wait... what? Then more.')).toBe('Wait...');
    expect(firstSentence('v1.2 shipped today. Next')).toBe('v1.2 shipped today.');
    expect(firstSentence('पहली बात। दूसरी')).toBe('पहली बात।');
    expect(firstSentence('Line one\nLine two')).toBe('Line one');
    expect(firstSentence('No end')).toBe('No end');
    expect(firstSentence('Ends?!')).toBe('Ends?!');
  });
  it('is linear on long terminator runs', () => {
    const text = `${'.'.repeat(200_000)}x`;
    const start = performance.now();
    expect(firstSentence(text)).toBe(text);
    expect(performance.now() - start).toBeLessThan(200);
  });
});

describe('countMidSentenceCapitals', () => {
  it('skips sentence starts, "I" forms and starts after newlines or quotes', () => {
    expect(countMidSentenceCapitals('Then I met Ravi at Zomato. Later "Big" news')).toBe(2);
    expect(countMidSentenceCapitals("I'm here\nNew line")).toBe(0);
    expect(countMidSentenceCapitals('\u{1F525} Delhi and Mumbai')).toBe(1);
  });
  it('is linear on large input', () => {
    const text = 'word Name '.repeat(50_000);
    const start = performance.now();
    expect(countMidSentenceCapitals(text)).toBe(50_000);
    expect(performance.now() - start).toBeLessThan(500);
  });
});

describe('HookScorer input cap', () => {
  it(`scores only the first ${String(MAX_SCORED_CODE_POINTS)} code points`, () => {
    const scorer = new HookScorer();
    const huge = 'I lost my first client because of one email. '.repeat(25_000);
    const start = performance.now();
    const score = scorer.score(huge, 'linkedin', 'en');
    expect(performance.now() - start).toBeLessThan(1000);
    expect(score).toEqual(scorer.score(huge.slice(0, MAX_SCORED_CODE_POINTS), 'linkedin', 'en'));
  });
  it('counts code points, not UTF-16 units, when capping', () => {
    const scorer = new HookScorer();
    const emoji = '\u{1F525}'.repeat(MAX_SCORED_CODE_POINTS + 10);
    expect(scorer.score(emoji, 'x', 'en')).toEqual(scorer.score('\u{1F525}'.repeat(MAX_SCORED_CODE_POINTS), 'x', 'en'));
  });
});
