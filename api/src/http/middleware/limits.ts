import type { MiddlewareHandler } from 'hono';
import { RateLimitError, UnavailableError } from '@hook/domain';
import type { Switches } from '../../ports';
import type { AppEnv } from '../types';

/**
 * Approximate per-isolate burst limiter (fixed 1-minute window). Free and DB-less: it blunts
 * floods (S-26) while Cloudflare's own DDoS protection handles the rest (C4).
 */
export class MemoryRateLimiter {
  readonly #limit: number;
  readonly #windows = new Map<string, { start: number; count: number }>();

  public constructor(limitPerMinute: number) {
    this.#limit = limitPerMinute;
  }

  public allow(key: string, now = Date.now()): boolean {
    const window = this.#windows.get(key);
    if (window === undefined || now - window.start >= 60_000) {
      if (this.#windows.size > 10_000) this.#windows.clear();
      this.#windows.set(key, { start: now, count: 1 });
      return true;
    }
    window.count += 1;
    return window.count <= this.#limit;
  }
}

export function burstLimit(limiter: MemoryRateLimiter, keyOf: (ip: string) => string = (ip) => ip): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const ip = c.req.header('cf-connecting-ip') ?? 'unknown';
    if (!limiter.allow(keyOf(ip))) throw new RateLimitError();
    await next();
  };
}

const AI_ROUTES = ['/v1/hooks/generate', '/v1/hooks/rewrite-post', '/v1/hooks/reels'];
const PAYMENT_ROUTES = ['/v1/pay/order', '/v1/billing/subscriptions', '/v1/billing/subscriptions/change-plan'];

/** Incident kill switches: KILL_AI, KILL_PAYMENTS, READ_ONLY (S-27). Webhooks keep working. */
export function killSwitches(switches: Switches): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const path = c.req.path;
    const write = c.req.method !== 'GET' && c.req.method !== 'OPTIONS';
    if (switches.readOnly && write && path !== '/v1/pay/webhook') throw new UnavailableError();
    if (switches.killAi && AI_ROUTES.includes(path)) throw new UnavailableError('Generation is paused for a moment. Please try again later.');
    if (switches.killPayments && PAYMENT_ROUTES.includes(path)) throw new UnavailableError('Payments are paused for a moment. Please try again later.');
    await next();
  };
}
