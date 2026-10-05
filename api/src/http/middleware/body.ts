import type { MiddlewareHandler } from 'hono';
import { PayloadTooLargeError, ValidationError } from '@hook/domain';
import type { AppEnv } from '../types';

/**
 * Reads the body ONCE with a hard byte cap (T13 / S-16: 5 MB -> 413) and requires JSON for
 * requests with a body. The raw text is kept for HMAC checks on the webhook.
 */
export function bodyLimit(maxBytes: number): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (c.req.method === 'GET' || c.req.method === 'OPTIONS' || c.req.method === 'DELETE') {
      c.set('rawBody', '');
      await next();
      return;
    }
    const declared = Number(c.req.header('content-length') ?? '0');
    if (Number.isFinite(declared) && declared > maxBytes) throw new PayloadTooLargeError();
    const type = c.req.header('content-type') ?? '';
    if (!/^application\/json\b/iu.test(type)) throw new ValidationError('Send JSON.');
    c.set('rawBody', await readCapped(c.req.raw, maxBytes));
    await next();
  };
}

async function readCapped(request: Request, maxBytes: number): Promise<string> {
  if (request.body === null) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new PayloadTooLargeError();
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}
