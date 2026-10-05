import type { AiTier } from '@hook/domain';
import type { TierConfig, TierEntry } from './application/ai/llm-router';
import { MODEL_TIERS, type ModelEntry } from './config/models';
import type { AppConfig } from './config/env';
import { SupabaseIdentityAdmin } from './infrastructure/auth/supabase-identity-admin';
import { SupabaseJwtVerifier } from './infrastructure/auth/supabase-jwt-verifier';
import { DevTokenVerifier, FakeLlmProvider } from './infrastructure/dev/fake-llm-provider';
import { DevBotVerifier, NoopIdentityAdmin, UnconfiguredPaymentGateway } from './infrastructure/dev/unconfigured';
import { GeminiProvider } from './infrastructure/llm/gemini-provider';
import { GroqProvider, OpenRouterProvider } from './infrastructure/llm/openai-compatible-provider';
import { WorkersAiModeration, WorkersAiProvider, type WorkersAiBinding } from './infrastructure/llm/workers-ai-provider';
import { RazorpayGateway } from './infrastructure/razorpay/razorpay-gateway';
import { TurnstileVerifier } from './infrastructure/turnstile/turnstile-verifier';
import type { ModerationCheck } from './application/hooks/content-policy';
import type { BotVerifier, IdentityAdmin, LlmProvider, PaymentGateway, SubscriptionGateway, TokenVerifier } from './ports';

const dev = (c: AppConfig): boolean => c.ENVIRONMENT === 'development';

export function tokenVerifier(c: AppConfig): TokenVerifier {
  if (c.DEV_AUTH && dev(c)) return new DevTokenVerifier();
  if (c.SUPABASE_URL === undefined) throw new Error('SUPABASE_URL is required');
  return new SupabaseJwtVerifier({
    jwksUrl: c.SUPABASE_JWKS_URL ?? `${c.SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
    issuer: `${c.SUPABASE_URL}/auth/v1`,
  });
}

export function botVerifier(c: AppConfig): BotVerifier {
  if (c.TURNSTILE_SECRET_KEY !== undefined) return new TurnstileVerifier({ secret: c.TURNSTILE_SECRET_KEY });
  if (dev(c)) return new DevBotVerifier();
  throw new Error('TURNSTILE_SECRET_KEY is required');
}

export function identityAdmin(c: AppConfig): IdentityAdmin {
  if (c.SUPABASE_URL !== undefined && c.SUPABASE_SECRET_KEY !== undefined) {
    return new SupabaseIdentityAdmin({ url: c.SUPABASE_URL, serviceKey: c.SUPABASE_SECRET_KEY });
  }
  return new NoopIdentityAdmin();
}

export function razorpay(c: AppConfig): PaymentGateway & SubscriptionGateway {
  if (c.RAZORPAY_KEY_ID === undefined || c.RAZORPAY_KEY_SECRET === undefined || c.RAZORPAY_WEBHOOK_SECRET === undefined) {
    return new UnconfiguredPaymentGateway();
  }
  return new RazorpayGateway({ keyId: c.RAZORPAY_KEY_ID, keySecret: c.RAZORPAY_KEY_SECRET, webhookSecret: c.RAZORPAY_WEBHOOK_SECRET });
}

function provider(entry: ModelEntry, c: AppConfig, ai: WorkersAiBinding | null): LlmProvider | null {
  switch (entry.kind) {
    case 'groq':
      return c.GROQ_API_KEY === undefined ? null : new GroqProvider({ apiKey: c.GROQ_API_KEY, model: entry.model });
    case 'gemini':
      return c.GEMINI_API_KEY === undefined ? null : new GeminiProvider({ apiKey: c.GEMINI_API_KEY, model: entry.model });
    case 'openrouter':
      return c.OPENROUTER_API_KEY === undefined ? null : new OpenRouterProvider({ apiKey: c.OPENROUTER_API_KEY, model: entry.model });
    case 'workers-ai':
      return ai === null ? null : new WorkersAiProvider({ ai, model: entry.model });
  }
}

/** Providers without keys are skipped; DEV_FAKE_AI replaces every tier in development. */
export function tiers(c: AppConfig, ai: WorkersAiBinding | null): TierConfig {
  const build = (tier: AiTier): TierEntry[] => {
    if (c.DEV_FAKE_AI && dev(c)) return [{ provider: new FakeLlmProvider(), dailyCap: 100_000 }];
    return MODEL_TIERS[tier].flatMap((entry) => {
      const p = provider(entry, c, ai);
      return p === null ? [] : [{ provider: p, dailyCap: entry.dailyCap }];
    });
  };
  return { free: build('free'), paid: build('paid'), priority: build('priority') };
}

export function moderation(ai: WorkersAiBinding | null): ModerationCheck | null {
  return ai === null ? null : new WorkersAiModeration(ai);
}
