import type { BotVerifier } from '../../ports';

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** Cloudflare Turnstile. Fails closed: any error = not verified (S-10). */
export class TurnstileVerifier implements BotVerifier {
  readonly #secret: string;
  readonly #fetch: typeof fetch;

  public constructor(options: { secret: string; fetchImpl?: typeof fetch }) {
    this.#secret = options.secret;
    this.#fetch = options.fetchImpl ?? fetch;
  }

  public async verify(token: string, ip: string | null): Promise<boolean> {
    const body = new FormData();
    body.set('secret', this.#secret);
    body.set('response', token);
    if (ip !== null) body.set('remoteip', ip);
    try {
      const response = await this.#fetch(SITEVERIFY, { method: 'POST', body, signal: AbortSignal.timeout(5_000) });
      if (!response.ok) return false;
      const data: unknown = await response.json();
      return typeof data === 'object' && data !== null && 'success' in data && data.success === true;
    } catch {
      return false;
    }
  }
}
