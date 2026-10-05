import { z } from 'zod';

const flag = z
  .enum(['0', '1', 'true', 'false', ''])
  .optional()
  .transform((v) => v === '1' || v === 'true');

const csv = z
  .string()
  .optional()
  .transform((v) => (v ?? '').split(',').map((s) => s.trim()).filter((s) => s !== ''));

/**
 * Worker vars + secrets (B9). Secrets are set with `wrangler secret put` only; locally they live
 * in api/.dev.vars (git-ignored). Parsed once per isolate; a bad config fails closed.
 */
export const EnvSchema = z.object({
  ENVIRONMENT: z.enum(['development', 'staging', 'production']),
  ALLOWED_ORIGINS: csv,
  SUPABASE_URL: z.url().optional(),
  SUPABASE_JWKS_URL: z.url().optional(),
  SUPABASE_SECRET_KEY: z.string().min(20).optional(),
  GROQ_API_KEY: z.string().min(10).optional(),
  GEMINI_API_KEY: z.string().min(10).optional(),
  OPENROUTER_API_KEY: z.string().min(10).optional(),
  RAZORPAY_ENV: z.enum(['test', 'live']).default('test'),
  RAZORPAY_KEY_ID: z.string().min(5).optional(),
  RAZORPAY_KEY_SECRET: z.string().min(10).optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(10).optional(),
  /** JSON: {"creator_monthly":"plan_X", ...} for the RAZORPAY_ENV environment. */
  RAZORPAY_PLAN_IDS: z.string().optional(),
  TURNSTILE_SECRET_KEY: z.string().min(10).optional(),
  ADMIN_USER_IDS: csv,
  KILL_AI: flag,
  KILL_PAYMENTS: flag,
  READ_ONLY: flag,
  /** Development only: in-memory repositories instead of Supabase. */
  USE_MEMORY_STORE: flag,
  /** Development only: canned AI responses, no provider keys needed. */
  DEV_FAKE_AI: flag,
  /** Development only: accept "dev.<uuid>" bearer tokens. Refused in any other environment. */
  DEV_AUTH: flag,
});
export type AppConfig = z.infer<typeof EnvSchema>;

export function parseEnv(raw: Readonly<Record<string, unknown>>): AppConfig {
  const config = EnvSchema.parse(raw);
  const devOnly = config.USE_MEMORY_STORE || config.DEV_FAKE_AI || config.DEV_AUTH;
  if (devOnly && config.ENVIRONMENT !== 'development') {
    throw new Error('Development-only switches are set outside development');
  }
  return config;
}

export function planIdsFrom(json: string | undefined): Record<string, string> {
  if (json === undefined || json.trim() === '') return {};
  return z.record(z.string(), z.string().regex(/^plan_[A-Za-z0-9]{6,40}$/u)).parse(JSON.parse(json));
}
