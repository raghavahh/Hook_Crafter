import { describe, expect, it } from 'vitest';
import { wrapText } from '../src';

describe('wrapText', () => {
  it('wraps greedily at word boundaries', () => {
    expect(wrapText('the quick brown fox jumps', 10, 5)).toEqual(['the quick', 'brown fox', 'jumps']);
  });
  it('adds "..." to the last line when truncated and stays within the width', () => {
    expect(wrapText('one two three four five six', 9, 2)).toEqual(['one two', 'three...']);
    const lines = wrapText('abcdefghij klm', 5, 1);
    expect(lines).toEqual(['ab...']);
  });
  it('splits words longer than a line', () => {
    expect(wrapText('abcdefghij', 4, 5)).toEqual(['abcd', 'efgh', 'ij']);
  });
  it('is grapheme-aware for emoji and Devanagari', () => {
    expect(wrapText('🔥🔥🔥🔥🔥', 2, 5)).toEqual(['🔥🔥', '🔥🔥', '🔥']);
    expect(wrapText('नमस्ते दुनिया', 40, 2)).toEqual(['नमस्ते दुनिया']);
  });
  it('keeps newlines as line breaks and drops blank lines', () => {
    expect(wrapText('first\n\nsecond line', 20, 5)).toEqual(['first', 'second line']);
  });
  it('handles degenerate limits', () => {
    expect(wrapText('anything', 10, 0)).toEqual([]);
    expect(wrapText('ab', 0, 3)).toEqual(['a', 'b']);
    expect(wrapText('', 10, 3)).toEqual([]);
  });
});
