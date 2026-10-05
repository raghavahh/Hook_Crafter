import type { AiTier } from '@hook/domain';

export type ProviderKind = 'groq' | 'gemini' | 'openrouter' | 'workers-ai';

export interface ModelEntry {
  readonly kind: ProviderKind;
  readonly model: string;
  /** Set to ~80% of the provider's CURRENT free daily limit. Check the dashboards before launch. */
  readonly dailyCap: number;
}

/**
 * Model ids change often: pick the current best FREE models at build time and update only here.
 * Tiers use different models/budget keys so free traffic can never drain paid capacity (S-11).
 * Paid providers are added to `paid`/`priority` by config only, after first sales (PRD A11).
 */
export const MODEL_TIERS: Readonly<Record<AiTier, readonly ModelEntry[]>> = {
  free: [
    { kind: 'groq', model: 'llama-3.1-8b-instant', dailyCap: 8000 },
    { kind: 'workers-ai', model: '@cf/meta/llama-3.1-8b-instruct-fast', dailyCap: 400 },
    { kind: 'gemini', model: 'gemini-2.5-flash-lite', dailyCap: 400 },
  ],
  paid: [
    { kind: 'groq', model: 'llama-3.3-70b-versatile', dailyCap: 800 },
    { kind: 'gemini', model: 'gemini-2.5-flash', dailyCap: 200 },
    { kind: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free', dailyCap: 40 },
  ],
  priority: [
    { kind: 'gemini', model: 'gemini-2.5-flash', dailyCap: 200 },
    { kind: 'groq', model: 'llama-3.3-70b-versatile', dailyCap: 800 },
    { kind: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free', dailyCap: 40 },
  ],
};
