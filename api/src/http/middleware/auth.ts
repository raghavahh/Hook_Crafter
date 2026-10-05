import type { MiddlewareHandler } from 'hono';
import { AuthError } from '@hook/domain';
import type { TokenVerifier } from '../../ports';
import type { AppEnv } from '../types';

/**
 * Bearer JWT only (no cookies, so no CSRF). The user id comes ONLY from the verified token
 * (T2). Tokens of deleted accounts are rejected even before they expire (S-25).
 */
export function requireUser(tokens: TokenVerifier, isDeleted: (userId: string) => Promise<boolean>): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const header = c.req.header('authorization') ?? '';
    const match = /^Bearer ([A-Za-z0-9_\-.]{20,4096})$/u.exec(header);
    if (match?.[1] === undefined) throw new AuthError();
    const user = await tokens.verify(match[1]);
    if (await isDeleted(user.id)) throw new AuthError();
    c.set('user', user);
    await next();
  };
}
