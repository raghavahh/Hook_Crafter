import { z } from 'zod';

/** Features that consume a counted credit. Reels uses `generate` (ADR-0003). */
export const COUNTED_FEATURES = ['generate', 'post_rewrite'] as const;
export type FeatureKey = (typeof COUNTED_FEATURES)[number];
export const FeatureKeySchema = z.enum(COUNTED_FEATURES);

/** Boolean unlocks granted by packs (permanent) or plans (while the period is valid). */
export const UNLOCK_KEYS = [
  'reels',
  'hindi',
  'all_languages',
  'voice_profiles',
  'collections',
  'batch',
] as const;
export type UnlockKey = (typeof UNLOCK_KEYS)[number];
export const UnlockKeySchema = z.enum(UNLOCK_KEYS);

/** AI tiers. Free traffic never touches paid/priority providers. */
export const AI_TIERS = ['free', 'paid', 'priority'] as const;
export type AiTier = (typeof AI_TIERS)[number];
export const AiTierSchema = z.enum(AI_TIERS);
