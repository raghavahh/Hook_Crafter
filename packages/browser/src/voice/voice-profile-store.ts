import { boundedText, LimitReachedError, UuidSchema, ValidationError } from '@hook/domain';
import { z } from 'zod';

export interface VoiceProfile {
  readonly id: string;
  readonly name: string;
  readonly niche: string;
  readonly audience: string;
  readonly style: string;
  readonly avoid: string;
}

export type VoiceProfileDraft = Omit<VoiceProfile, 'id'> & { readonly id?: string };

export interface RequestVoice {
  readonly niche: string;
  readonly audience: string;
  readonly style: string;
  readonly avoid: string;
}

export type VoiceStorage = Pick<Storage, 'getItem' | 'setItem'>;

export const VOICE_PROFILES_STORAGE_KEY = 'hook-crafter.voice-profiles.v1';
export const MAX_VOICE_PROFILES = 10;

/** Limits in code points, matching the server's VoiceProfileSchema. */
const StoredProfileSchema = z.strictObject({
  id: UuidSchema,
  name: boundedText(1, 40),
  niche: boundedText(0, 60),
  audience: boundedText(0, 100),
  style: boundedText(0, 100),
  avoid: boundedText(0, 100),
});

/**
 * A v4 UUID. crypto.randomUUID only exists in secure contexts (HTTPS, localhost), so fall
 * back to one built from crypto.getRandomValues, which works everywhere.
 */
export function newProfileId(): string {
  try {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    // Fall through to getRandomValues.
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
}

/**
 * Voice Profiles live ONLY in this browser (PRD A6.4): no server storage.
 * Every storage access is guarded (private mode, quota, blocked storage); data read back is
 * Zod-validated and corrupt entries are dropped. Falls back to memory when storage is unusable.
 */
export class VoiceProfileStore {
  readonly #storage: VoiceStorage | null;
  #memory: readonly VoiceProfile[] = [];
  /** Set once a write fails: from then on memory is the source of truth for this session. */
  #memoryOnly = false;

  public constructor(storage: VoiceStorage | null) {
    this.#storage = storage;
  }

  public list(): VoiceProfile[] {
    return [...this.#read()];
  }

  /** Creates (no id) or replaces (existing id) a profile. Throws ValidationError / LimitReachedError. */
  public save(draft: VoiceProfileDraft): VoiceProfile {
    const parsed = StoredProfileSchema.safeParse({ ...draft, id: draft.id ?? newProfileId() });
    if (!parsed.success) throw new ValidationError('Please check the voice profile fields.');
    const profile: VoiceProfile = Object.freeze(parsed.data);
    const current = this.#read();
    const exists = current.some((p) => p.id === profile.id);
    if (!exists && current.length >= MAX_VOICE_PROFILES) {
      throw new LimitReachedError(`You can save up to ${String(MAX_VOICE_PROFILES)} voice profiles.`);
    }
    this.#write(exists ? current.map((p) => (p.id === profile.id ? profile : p)) : [...current, profile]);
    return profile;
  }

  public remove(id: string): void {
    const current = this.#read();
    const next = current.filter((p) => p.id !== id);
    if (next.length !== current.length) this.#write(next);
  }

  /** The bounded fields sent with a generation request (the name stays local). */
  public toRequestVoice(profile: VoiceProfile): RequestVoice {
    return { niche: profile.niche, audience: profile.audience, style: profile.style, avoid: profile.avoid };
  }

  #read(): readonly VoiceProfile[] {
    if (this.#storage === null || this.#memoryOnly) return this.#memory;
    let raw: string | null;
    try {
      raw = this.#storage.getItem(VOICE_PROFILES_STORAGE_KEY);
    } catch {
      return this.#memory;
    }
    return raw === null ? [] : this.#parse(raw);
  }

  #parse(raw: string): readonly VoiceProfile[] {
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return [];
    }
    if (!Array.isArray(data)) return [];
    const seen = new Set<string>();
    const profiles: VoiceProfile[] = [];
    for (const item of data) {
      const parsed = StoredProfileSchema.safeParse(item);
      if (!parsed.success || seen.has(parsed.data.id)) continue;
      seen.add(parsed.data.id);
      profiles.push(Object.freeze(parsed.data));
    }
    return profiles.slice(0, MAX_VOICE_PROFILES);
  }

  #write(profiles: readonly VoiceProfile[]): void {
    this.#memory = Object.freeze([...profiles]);
    if (this.#storage === null) return;
    try {
      this.#storage.setItem(VOICE_PROFILES_STORAGE_KEY, JSON.stringify(profiles));
    } catch {
      // Storage full or blocked: keep the in-memory copy for this session.
      this.#memoryOnly = true;
    }
  }
}
