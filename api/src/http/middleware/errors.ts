import type { Context } from 'hono';
import { AppError, NotFoundError, type ErrorCode } from '@hook/domain';
import type { Logger } from '../../ports';
import type { AppEnv } from '../types';

function jsonError(status: number, code: ErrorCode, message: string, requestId: string): Response {
  return new Response(JSON.stringify({ error: { code, message, requestId } }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

/** The ONE place typed errors become HTTP responses. Never leaks stacks or internals. */
export function errorResponse(c: Context<AppEnv>, error: AppError): Response {
  return jsonError(error.httpStatus, error.code, error.message, c.get('requestId'));
}

export function onError(logger: Logger) {
  return (error: Error, c: Context<AppEnv>): Response => {
    if (error instanceof AppError && error.code !== 'INTERNAL') return errorResponse(c, error);
    logger.error('unhandled', { name: error.name, route: c.req.path, requestId: c.get('requestId') });
    return jsonError(500, 'INTERNAL', 'Something went wrong. Please try again.', c.get('requestId'));
  };
}

/** Unknown routes AND hidden admin routes return exactly this (ADR-0004). */
export function notFound(c: Context<AppEnv>): Response {
  return errorResponse(c, new NotFoundError());
}
