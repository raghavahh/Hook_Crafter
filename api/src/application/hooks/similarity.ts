/** Word-bigram Jaccard similarity (0..1). Used to reject near-duplicate hooks (>= 0.8). */
export function similarity(a: string, b: string): number {
  const ga = bigrams(a);
  const gb = bigrams(b);
  if (ga.size === 0 && gb.size === 0) return 1;
  let shared = 0;
  for (const g of ga) if (gb.has(g)) shared += 1;
  return shared / (ga.size + gb.size - shared);
}

function bigrams(text: string): Set<string> {
  const words = text.toLowerCase().split(/[^\p{L}\p{M}\p{N}]+/u).filter((w) => w !== '');
  if (words.length === 1) return new Set(words);
  const out = new Set<string>();
  for (let i = 0; i < words.length - 1; i += 1) out.add(`${words[i] ?? ''} ${words[i + 1] ?? ''}`);
  return out;
}

export function hasNearDuplicates(texts: readonly string[], threshold = 0.8): boolean {
  for (let i = 0; i < texts.length; i += 1) {
    for (let j = i + 1; j < texts.length; j += 1) {
      if (similarity(texts[i] ?? '', texts[j] ?? '') >= threshold) return true;
    }
  }
  return false;
}
