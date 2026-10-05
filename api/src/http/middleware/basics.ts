import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types';

export function requestId(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    c.set('requestId', crypto.randomUUID());
    await next();
    c.header('x-request-id', c.get('requestId'));
  };
}

/** API responses: never cached, never framed, never sniffed (C3 API). */
export function securityHeaders(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    await next();
    c.header('Cache-Control', 'no-store');
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    c.header('Referrer-Policy', 'no-referrer');
    c.header('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  };
}

/** Deny-by-default CORS: only allowlisted origins get CORS headers (T14 / S-17). */
export function cors(allowedOrigins: readonly string[]): MiddlewareHandler<AppEnv> {
  const allowed = new Set(allowedOrigins);
  return async (c, next) => {
    const origin = c.req.header('origin');
    const ok = origin !== undefined && allowed.has(origin);
    if (c.req.method === 'OPTIONS') {
      if (ok) {
        c.header('Access-Control-Allow-Origin', origin);
        c.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
        c.header('Access-Control-Allow-Headers', 'authorization, content-type');
        c.header('Access-Control-Max-Age', '600');
        c.header('Vary', 'Origin');
      }
      return c.body(null, 204);
    }
    await next();
    if (ok) {
      c.header('Access-Control-Allow-Origin', origin);
      c.header('Access-Control-Expose-Headers', 'x-request-id');
      c.header('Vary', 'Origin');
    }
    return undefined;
  };
}
