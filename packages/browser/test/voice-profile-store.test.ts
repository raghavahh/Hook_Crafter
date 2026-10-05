import { LimitReachedError, ValidationError } from '@hook/domain';
import { describe, expect, it } from 'vitest';
import { VoiceProfileStore } from '../src';

const KEY = 'hook-crafter.voice-profiles.v1';

class MemoryStorage {
  readonly #data = new Map<string, string>();
  public getItem(key: string): string | null {
    return this.#data.get(key) ?? null;
  }
  public setItem(key: string, value: string): void {
    this.#data.set(key, value);
  }
}

const draft = { name: 'Founder voice', niche: 'B2B SaaS', audience: 'Indian founders', style: 'Short, blunt', avoid: 'hustle' };

describe('VoiceProfileStore', () => {
  it('saves, lists, updates and removes profiles in storage', () => {
    const storage = new MemoryStorage();
    const store = new VoiceProfileStore(storage);
    expect(store.list()).toEqual([]);
    const saved = store.save(draft);
    expect(saved.id).toMatch(/^[0-9a-f-]{36}$/u);
    expect(new VoiceProfileStore(storage).list()).toEqual([saved]);
    const updated = store.save({ ...draft, id: saved.id, name: 'Renamed' });
    expect(store.list()).toEqual([updated]);
    store.remove('missing');
    store.remove(saved.id);
    expect(store.list()).toEqual([]);
  });

  it('sanitises fields and enforces code-point limits', () => {
    const store = new VoiceProfileStore(new MemoryStorage());
    expect(store.save({ ...draft, name: '  ‮Founder  ' }).name).toBe('Founder');
    expect(() => store.save({ ...draft, name: 'x'.repeat(41) })).toThrow(ValidationError);
    expect(() => store.save({ ...draft, niche: 'x'.repeat(61) })).toThrow(ValidationError);
    expect(() => store.save({ ...draft, avoid: 'x'.repeat(101) })).toThrow(ValidationError);
    expect(() => store.save({ ...draft, id: 'not-a-uuid' })).toThrow(ValidationError);
  });

  it('stores at most 10 profiles', () => {
    const store = new VoiceProfileStore(new MemoryStorage());
    for (let i = 0; i < 10; i += 1) store.save({ ...draft, name: `Voice ${String(i)}` });
    expect(() => store.save(draft)).toThrow(LimitReachedError);
    const first = store.list()[0];
    if (first === undefined) throw new Error('missing');
    expect(() => store.save({ ...draft, id: first.id })).not.toThrow();
  });

  it('drops corrupt, duplicate and invalid stored data', () => {
    const storage = new MemoryStorage();
    const store = new VoiceProfileStore(storage);
    storage.setItem(KEY, '{not json');
    expect(store.list()).toEqual([]);
    storage.setItem(KEY, JSON.stringify({ not: 'an array' }));
    expect(store.list()).toEqual([]);
    const good = { id: '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e', ...draft };
    storage.setItem(KEY, JSON.stringify([good, good, { ...good, id: 'x' }, { ...good, extra: 1 }, 42]));
    expect(store.list()).toEqual([good]);
  });

  it('works in memory with null storage', () => {
    const store = new VoiceProfileStore(null);
    const saved = store.save(draft);
    expect(store.list()).toEqual([saved]);
    store.remove(saved.id);
    expect(store.list()).toEqual([]);
  });

  it('survives storage that throws on read or write', () => {
    const throwing = {
      getItem: (): string | null => {
        throw new Error('SecurityError');
      },
      setItem: (): void => {
        throw new Error('QuotaExceededError');
      },
    };
    const store = new VoiceProfileStore(throwing);
    expect(store.list()).toEqual([]);
    const saved = store.save(draft);
    expect(store.list()).toEqual([saved]);
    const full = new MemoryStorage();
    const failingWrite = { getItem: (k: string) => full.getItem(k), setItem: throwing.setItem };
    const store2 = new VoiceProfileStore(failingWrite);
    const kept = store2.save(draft);
    expect(store2.list()).toEqual([kept]);
  });

  it('maps a profile to the request voice without its name or id', () => {
    const store = new VoiceProfileStore(null);
    const saved = store.save(draft);
    expect(store.toRequestVoice(saved)).toEqual({ niche: 'B2B SaaS', audience: 'Indian founders', style: 'Short, blunt', avoid: 'hustle' });
  });
});
