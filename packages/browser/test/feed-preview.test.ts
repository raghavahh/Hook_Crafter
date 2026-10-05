import { graphemes, rulesFor, TextSanitizer, type Platform } from '@hook/domain';
import { describe, expect, it } from 'vitest';
import { FeedPreviewModel } from '../src';

const model = new FeedPreviewModel();
const words = (count: number): string => Array.from({ length: count }, (_, i) => `word${String(i % 10)}`).join(' ');

function expectLossless(text: string, platform: Platform): ReturnType<FeedPreviewModel['render']> {
  const preview = model.render(text, platform);
  expect(preview.visible + preview.hidden).toBe(TextSanitizer.clean(text));
  expect(graphemes(preview.visible).length + graphemes(preview.hidden).length).toBe(graphemes(TextSanitizer.clean(text)).length);
  expect(preview.approximate).toBe(true);
  return preview;
}

describe('FeedPreviewModel', () => {
  it('shows short text in full', () => {
    expect(model.render('Short hook.', 'linkedin')).toEqual({ visible: 'Short hook.', hidden: '', truncated: false, approximate: true });
  });

  it('cuts multi-line LinkedIn text after 3 lines', () => {
    const preview = expectLossless('Line one\nLine two\nLine three\nLine four', 'linkedin');
    expect(preview.visible).toBe('Line one\nLine two\nLine three');
    expect(preview.hidden).toBe('\nLine four');
    expect(preview.truncated).toBe(true);
  });

  it('is not truncated when only whitespace is hidden', () => {
    const preview = expectLossless('a\nb\nc\n', 'linkedin');
    expect(preview.truncated).toBe(false);
    expect(preview.hidden).toBe('\n');
  });

  it.each<Platform>(['linkedin', 'x', 'instagram_caption', 'shorts_title', 'reels_script'])(
    'stops at the line or character cut-off on %s, at a word boundary',
    (platform) => {
      const rules = rulesFor(platform);
      const limit = Math.min(rules.seeMoreCutoff, rules.previewLines * rules.charsPerLine);
      const preview = expectLossless(words(80), platform);
      const shown = graphemes(preview.visible).length;
      expect(preview.truncated).toBe(true);
      expect(shown).toBeLessThanOrEqual(limit);
      expect(shown).toBeGreaterThan(limit - 16);
      expect(preview.visible.endsWith(' ') || preview.hidden.startsWith(' ')).toBe(true);
    },
  );

  it('hard-cuts text with no spaces exactly at the limit', () => {
    expect(expectLossless('a'.repeat(300), 'instagram_caption').visible).toBe('a'.repeat(88));
    expect(expectLossless('a'.repeat(300), 'x').visible).toBe('a'.repeat(280));
  });

  it('counts an emoji as one character and never splits it', () => {
    const preview = expectLossless('🔥'.repeat(200), 'instagram_caption');
    expect(graphemes(preview.visible)).toHaveLength(88);
    expect(preview.visible).toBe('🔥'.repeat(88));
    const family = '👨\u200D👩\u200D👧';
    const zwj = expectLossless(family.repeat(100), 'shorts_title');
    expect(graphemes(zwj.visible)).toHaveLength(70);
  });

  it('counts Devanagari by grapheme and keeps conjuncts whole', () => {
    const text = 'नमस्ते दुनिया क्षत्रिय '.repeat(20);
    const preview = expectLossless(text, 'instagram_caption');
    expect(preview.truncated).toBe(true);
    expect(graphemes(preview.visible).length).toBeLessThanOrEqual(88);
    expect(graphemes(preview.visible).length).toBeLessThan(preview.visible.length);
  });

  it('works on the sanitised text', () => {
    const preview = expectLossless('\u202EHello\u200B world', 'linkedin');
    expect(preview.visible).toBe('Hello world');
  });

  it('wraps long lines before counting newlines', () => {
    // 60 graphemes at 48 per line = 2 rendered lines, so "second" is line 3.
    const preview = expectLossless(`${'a'.repeat(60)}\nsecond\nthird`, 'linkedin');
    expect(preview.visible).toBe(`${'a'.repeat(60)}\nsecond`);
    expect(expectLossless(`${'a'.repeat(100)}\nsecond`, 'linkedin').visible).toBe('a'.repeat(100));
  });
});
