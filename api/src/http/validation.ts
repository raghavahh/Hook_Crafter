import type { Context } from 'hono';
import type { z } from 'zod';
import { ValidationError } from '@hook/domain';
import type { AppEnv } from './types';

/** Zod strict parse of the (already size-capped) JSON body. Unknown keys -> 400 (S-03). */
export function parseBody<S extends z.ZodType>(c: Context<AppEnv>, schema: S): z.output<S> {
  let json: unknown;
  try {
    json = JSON.parse(c.get('rawBody')) as unknown;
  } catch {
    throw new ValidationError('Invalid JSON.');
  }
  const result = schema.safeParse(json);
  if (!result.success) throw new ValidationError(firstIssue(result.error));
  return result.data;
}

export function parseQuery<S extends z.ZodType>(c: Context<AppEnv>, schema: S): z.output<S> {
  const result = schema.safeParse(c.req.query());
  if (!result.success) throw new ValidationError(firstIssue(result.error));
  return result.data;
}

/** Field name + short reason only; never echoes the submitted value. */
function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (issue === undefined) return 'The request is invalid.';
  const field = issue.path.join('.');
  return field === '' ? 'The request is invalid.' : `Invalid field: ${field}.`;
}
