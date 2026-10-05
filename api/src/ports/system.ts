/** Time is injected so domain/application code stays pure and testable (S-SUB-09). */
export interface Clock {
  now(): Date;
}

export type LogValue = string | number | boolean | null;
/** Field-allowlisted structured logger: callers pass ids/counters only, never user text. */
export interface Logger {
  info(event: string, fields?: Readonly<Record<string, LogValue>>): void;
  warn(event: string, fields?: Readonly<Record<string, LogValue>>): void;
  error(event: string, fields?: Readonly<Record<string, LogValue>>): void;
}

export interface VerifiedUser {
  readonly id: string;
  readonly email: string | null;
}

/** Verifies a Supabase JWT (JWKS, pinned alg, exp/iss/aud). Throws AuthError. */
export interface TokenVerifier {
  verify(token: string): Promise<VerifiedUser>;
}

/** Cloudflare Turnstile. */
export interface BotVerifier {
  verify(token: string, ip: string | null): Promise<boolean>;
}

export interface LlmRequest {
  readonly system: string;
  readonly user: string;
  readonly maxTokens: number;
  readonly temperature: number;
}

export type ProviderFailure = 'rate_limited' | 'timeout' | 'failed';

export class ProviderError extends Error {
  public readonly kind: ProviderFailure;
  public constructor(kind: ProviderFailure, message: string) {
    super(message);
    this.kind = kind;
    this.name = 'ProviderError';
  }
}

/** One AI provider/model. Returns the raw JSON text; throws ProviderError. */
export interface LlmProvider {
  readonly id: string;
  complete(request: LlmRequest, signal: AbortSignal): Promise<string>;
}
